extends "res://fps.gd"

var bull_choice: OptionButton
var bull_map_choice: OptionButton
var gate_walls: Array = []
var arena_gates: Dictionary = {}
var gate_sounds: Dictionary = {}
var clank_player: AudioStreamPlayer
var choice_ids: Array = []
const BULL_RADIUS := 44.0
var roster_key := ""
var model_data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://bull-models.json"))

func _exit_tree() -> void:
	socket.close()
	for unused in [bases,flag,flag_banner,flag_pickup]:
		if is_instance_valid(unused) and unused.get_parent() == null:
			unused.free()

func _ready() -> void:
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	var env := WorldEnvironment.new()
	var background := Environment.new()
	background.background_mode = Environment.BG_COLOR
	background.background_color = Color("#293d46")
	background.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	background.ambient_light_color = Color("#fff0d8")
	background.ambient_light_energy = .8
	env.environment = background
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55,-30,0)
	sun.light_energy = .8
	add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 100
	camera.position = Vector3(0,65,74)
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	var floor_node := MeshInstance3D.new()
	var floor_mesh := CylinderMesh.new()
	floor_mesh.top_radius = BULL_RADIUS
	floor_mesh.bottom_radius = BULL_RADIUS
	floor_mesh.height = .2
	floor_mesh.radial_segments = 96
	floor_node.mesh = floor_mesh
	var sand := StandardMaterial3D.new()
	sand.albedo_color = Color("#dcb37a")
	floor_node.material_override = sand
	floor_node.position.y = -.1
	add_child(floor_node)
	for i in range(160):
		var angle := i/160.0*TAU
		var wall := block(self,Vector3(1.73,1.55,.35),Vector3(sin(angle)*BULL_RADIUS,.775,cos(angle)*BULL_RADIUS),Color("#f2dec3") if i%5 == 0 else Color("#b94539"))
		wall.rotation.y = angle
		gate_walls.append({"angle":angle,"wall":wall})
		for tier in range(4):
			var radius := BULL_RADIUS+1.5+tier*1.6
			var seat := block(self,Vector3(2.1,.7,1.7),Vector3(sin(angle)*radius,.5+tier*.8,cos(angle)*radius),Color("#c28b5e") if tier%2 == 0 else Color("#995c42"))
			seat.rotation.y = angle
			block(self,Vector3(.35,.5,.35),Vector3(sin(angle)*radius,1.1+tier*.8,cos(angle)*radius),Color("#325777") if i%2 == 0 else Color("#ebd9a8"))
	build_gates()
	build_ui()
	score_strip.add_child(match_clock)
	var layout: VBoxContainer = lobby.get_child(0)
	lobby_title.text = "BULL RUN / 투우 대기실"
	lobby_hint.text = "황소: 왼쪽 전진 · 오른쪽 ◀▶ 회전 · 사람은 뿔을 피하세요"
	teams_input.hide()
	teams_input.get_parent().get_child(0).hide()
	configure_button.text = "경기 시간 적용"
	start_button.text = "▶ 투우 시작"
	bull_choice = OptionButton.new()
	bull_choice.item_selected.connect(func(index):send_admin({"type":"bull-choice","id":choice_ids[index]}))
	layout.add_child(bull_choice)
	layout.move_child(bull_choice,configure_button.get_index()+1)
	bull_map_choice = OptionButton.new()
	bull_map_choice.add_item("맵 1 · 참가자 황소")
	bull_map_choice.add_item("맵 2 · 원형 경기장 문 돌진")
	bull_map_choice.item_selected.connect(func(index):send_admin({"type":"bull-map","map":"gates" if index == 1 else "classic"}))
	layout.add_child(bull_map_choice)
	layout.move_child(bull_map_choice,configure_button.get_index()+1)
	fetch_config()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--bull-fixture="):
			set_process(false)
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--bull-fixture="))))
			for gate in arena_gates.values():
				gate.door.position.y = 4.2 if gate.open else 0
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://../.runtime/bull-pc.png")
			get_tree().quit()

func accept_state(message: Dictionary) -> void:
	if message.get("game") != "bull":
		return
	state = message
	var phase: String = message.phase
	var gate_map: bool = message.bull.get("map","classic") == "gates"
	bull_map_choice.disabled = phase != "lobby" or not authenticated
	bull_map_choice.select(1 if gate_map else 0)
	bull_choice.visible = not gate_map
	lobby_hint.text = "모두 사람 · 문이 열리면 직선 돌진 · 황소 속도 고정" if gate_map else "황소: 왼쪽 전진 · 오른쪽 ◀▶ 회전 · 사람은 뿔을 피하세요"
	var celebrating: bool = phase == "finished" and message.bull.get("celebration",{}).get("ready",false)
	camera.size = 36 if celebrating else 100
	camera.position = Vector3(0,30,34) if celebrating else Vector3(0,65,74)
	camera.look_at(Vector3.ZERO)
	update_gates(message,gate_map)
	status.text = "BULL RUN · %s · %d초" % [{"lobby":"대기실","running":"경기 중","finished":"경기 종료"}[phase],ceil(message.remaining)]
	match_clock.text = "%02d:%02d" % [int(message.remaining)/60,int(message.remaining)%60]
	ranking.text = "황소는 모두 아웃시키면 승리 · 사람은 시간까지 생존하면 승리"
	if gate_map:
		ranking.text = "문 돌진 · 속도 12 고정 · 시간이 갈수록 황소 증가"
	if phase == "running":
		for p in message.players:
			if p.get("participating",false) and p.role == "human":
				ranking.text += "\n%s · %.1f초 · %s" % [p.name,p.survival,"생존" if p.alive else "아웃"]
	if phase == "finished":
		ranking.text = "황소 승리!" if message.results.winner == "bull" else "사람 승리!"
		ranking.text += "\n전진 버튼으로 뒤에서 돌진하세요" if message.results.winner == "bull" and not gate_map else "\n빨간 천 버튼으로 승리 인사" if message.results.winner == "humans" else ""
		for p in message.results.players:
			ranking.text += "\n%s · %s" % [p.name,"황소" if p.role == "bull" else "%.2f초 · %s" % [p.survival,"생존" if p.alive else "아웃"]]
	preload("res://lobby_ui.gd").sync(lobby,phase)
	start_button.disabled = not authenticated or phase != "lobby" or message.players.filter(func(p):return p.connected).size() < (1 if gate_map else 2)
	return_button.disabled = not authenticated
	time_input.value = message.duration
	bull_choice.disabled = phase != "lobby" or not authenticated
	var key := JSON.stringify([message.bull.choice,message.players.map(func(p):return [p.id,p.name,p.connected])])
	if key != roster_key:
		roster_key = key
		bull_choice.clear()
		bull_choice.add_item("매 라운드 무작위 황소")
		choice_ids = ["random"]
		for child in roster.get_children():
			child.queue_free()
		for p in message.players:
			roster.add_child(text_label("%s %s" % [p.name,"●" if p.connected else "연결 끊김"],18))
			if p.connected:
				bull_choice.add_item(p.name)
				choice_ids.append(p.id)
		bull_choice.select(maxi(0,choice_ids.find(message.bull.choice)))
	var all_actors: Array = message.players.duplicate()
	all_actors.append_array(message.bull.get("bulls",[]))
	for p in all_actors:
		if actors.has(p.id) and actors[p.id].get_meta("role") != p.role:
			actors[p.id].queue_free()
			actors.erase(p.id)
		if not actors.has(p.id):
			var root := Node3D.new()
			root.set_meta("role",p.role)
			var model := solid_model(p.role)
			model.name = "Model"
			root.add_child(model)
			var name_tag := Label3D.new()
			name_tag.font = FONT
			name_tag.text = p.name
			name_tag.font_size = 40
			name_tag.pixel_size = .03
			name_tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			name_tag.position.y = 3.6
			root.add_child(name_tag)
			var heading := block(root,Vector3(.35,.08,1.1),Vector3(0,.1,2),Color("#ffe8a0"))
			heading.name = "Heading"
			actors[p.id] = root
			add_child(root)
		var actor: Node3D = actors[p.id]
		actor.position = Vector3(p.x,p.y,p.z)
		actor.visible = p.get("participating",false) or phase == "lobby"
		if p.has("release"):
			actor.visible = float(message.bull.elapsed) >= float(p.release) and phase == "running"
		var heading: Node3D = actor.get_node("Heading")
		heading.position = Vector3(sin(p.yaw)*2,.1,cos(p.yaw)*2)
		heading.rotation.y = p.yaw
		var model: Node3D = actor.get_node("Model")
		if p.get("flight") is Dictionary:
			var fraction := clampf((float(message.bull.elapsed)-float(p.flight.start))/float(p.flight.duration),0,1)
			model.rotation = Vector3(fraction*7,p.yaw,fraction*3)
		else:
			model.rotation = Vector3(0,p.yaw,0)
		var old: Vector3 = actor.get_meta("last_position",actor.position)
		if actor.position.distance_to(old) > .002:
			actor.set_meta("moving_until",elapsed+.15)
		actor.set_meta("last_position",actor.position)
		animate_model(actor,p,(phase == "running" or celebrating) and ((p.stun <= 0 and float(p.get("speed",0)) > 0 if p.role == "bull" else elapsed < float(actor.get_meta("moving_until",0)))))
	for id in actors.keys():
		if not all_actors.any(func(p):return p.id == id):
			actors[id].queue_free()
			actors.erase(id)

func _process(delta: float) -> void:
	elapsed += delta
	if state.get("game") == "bull":
		var all_actors: Array = state.players.duplicate()
		all_actors.append_array(state.bull.get("bulls",[]))
		for p in all_actors:
			if actors.has(p.id):
				var actor: Node3D = actors[p.id]
				animate_model(actor,p,(state.phase == "running" or state.bull.get("celebration",{}).get("ready",false)) and ((p.stun <= 0 and float(p.get("speed",0)) > 0 if p.role == "bull" else elapsed < float(actor.get_meta("moving_until",0)))))
		for gate in arena_gates.values():
			gate.door.position.y = move_toward(gate.door.position.y,4.2 if gate.open else 0,delta*10)
	socket.poll()
	if socket.get_ready_state() == WebSocketPeer.STATE_CLOSED and elapsed-last_connect > 2:
		last_connect = elapsed
		authenticated = false
		socket.remove_meta("joined")
		start_button.disabled = true
		return_button.disabled = true
		fetch_config()
		socket.connect_to_url(server_url.replace("https://","wss://").replace("http://","ws://"))
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		if not socket.has_meta("joined") and not admin_key.is_empty():
			socket.send_text(JSON.stringify({"type":"host","key":admin_key}))
			socket.set_meta("joined",true)
		while socket.get_available_packet_count() > 0:
			var message = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if not message is Dictionary:
				continue
			if message.type == "host-ready":
				authenticated = true
				send_admin({"type":"game","game":"bull"})
			elif message.type == "state" and authenticated:
				accept_state(message)
			elif message.type == "error":
				status.text = message.message
	elif elapsed-last_config > 3:
		fetch_config()

var brick_meshes: Dictionary = {}
var brick_material: StandardMaterial3D

func create_gate(angle: float) -> Dictionary:
	var root := Node3D.new()
	root.position = Vector3(sin(angle)*BULL_RADIUS,0,cos(angle)*BULL_RADIUS)
	root.rotation.y = angle
	add_child(root)
	for x in [-2.5,2.5]:
		block(root,Vector3(.45,4.2,.7),Vector3(x,2.1,0),Color("#51443a"))
	block(root,Vector3(5.4,.4,.7),Vector3(0,4.2,0),Color("#51443a"))
	var door := Node3D.new()
	root.add_child(door)
	for bar in range(9):
		block(door,Vector3(.16,3.8,.25),Vector3((bar-4)*.55,1.9,0),Color("#667078"))
	for y in [.5,3.3]:
		block(door,Vector3(4.8,.16,.3),Vector3(0,y,0),Color("#39434c"))
	return {"root":root,"door":door,"open":false,"angle":angle}

func build_gates() -> void:
	clank_player = AudioStreamPlayer.new()
	var sound := AudioStreamWAV.new()
	sound.format = AudioStreamWAV.FORMAT_16_BITS
	sound.mix_rate = 22050
	var data := PackedByteArray()
	data.resize(4410*2)
	for i in range(4410):
		var t := i/22050.0
		var sample := (sin(TAU*220*t)+sin(TAU*613*t)*.5+sin(TAU*1193*t)*.25)*exp(-t*28)*.22
		data.encode_s16(i*2,int(sample*32767))
	sound.data = data
	clank_player.stream = sound
	add_child(clank_player)

func update_gates(message: Dictionary, gate_map: bool) -> void:
	var bulls: Array = message.bull.get("bulls",[])
	var active := {}
	if gate_map:
		for b in bulls:
			for side in ["from","to"]:
				if (b.progress >= 12 if side == "from" else b.distance-b.progress >= 12):
					continue
				var key: String = b.id+":"+side
				active[key] = true
				if not arena_gates.has(key):
					arena_gates[key] = create_gate(float(b[side]))
				arena_gates[key].open = b.progress < 6 if side == "from" else true
	for key in arena_gates.keys():
		if not active.has(key):
			arena_gates[key].root.queue_free()
			arena_gates.erase(key)
	for segment in gate_walls:
		segment.wall.visible = not arena_gates.values().any(func(g):return absf(wrapf(float(segment.angle)-float(g.angle),-PI,PI)) < .077)
	if message.phase == "lobby":
		gate_sounds.clear()
	for b in bulls:
		if not gate_sounds.has(b.id):
			gate_sounds[b.id] = true
			if message.phase == "running":
				clank_player.play()

func solid_model(role: String) -> Node3D:
	var root := Node3D.new()
	var joints := {}
	for j in model_data[role].joints:
		var joint := Node3D.new()
		joint.position = Vector3(j.pos[0],j.pos[1],j.pos[2])
		if j.parent == null:
			root.add_child(joint)
		else:
			joints[j.parent].add_child(joint)
		joints[j.id] = joint
	if brick_material == null:
		brick_material = StandardMaterial3D.new()
		brick_material.vertex_color_use_as_albedo = true
		brick_material.roughness = .85
	for p in model_data[role].parts:
		var key: String = role+":"+p.joint
		if not brick_meshes.has(key):
			brick_meshes[key] = preload("res://brick_model.gd").mesh(p)
		var node := MeshInstance3D.new()
		node.mesh = brick_meshes[key]
		node.material_override = brick_material
		joints[p.joint].add_child(node)
	if role == "human":
		var cape := block(root,Vector3(1.8,1.25,.04),Vector3(0,1.12,1.02),Color("#db1735"))
		cape.name = "Cape"
		cape.hide()
	root.set_meta("joints",joints)
	return root

func animate_model(actor: Node3D, p: Dictionary, moving: bool) -> void:
	var model: Node3D = actor.get_node("Model")
	var joints: Dictionary = model.get_meta("joints")
	joints.body.position.x = 0
	joints.body.rotation.z = 0
	joints.head.rotation.z = 0
	if model.has_node("Cape"):
		model.get_node("Cape").visible = p.get("celebrationPose","") == "cape" and not p.get("flight") is Dictionary
	var wave := sin(elapsed*(11 if p.role == "bull" else 13))
	if p.role == "bull":
		joints.body.position.y = absf(wave)*.06 if moving else 0
		joints.head.rotation.x = -sin(float(p.get("lift",0))/.45*PI)*.65+(wave*.04 if moving else 0)
		joints.tail.rotation.z = sin(elapsed*5)*.22
		for pair in [["legLF",1],["legRF",-1],["legLB",-1],["legRB",1]]:
			joints[pair[0]].rotation.x = wave*.5*pair[1] if moving else 0
	else:
		joints.body.position.y = absf(wave)*.09 if moving else 0
		for pair in [["L",1],["R",-1]]:
			var side: String = pair[0]
			var sign: float = pair[1]
			joints["leg"+side].rotation.x = wave*.65*sign if moving else 0
			joints["shin"+side].rotation.x = maxf(0,-wave*sign)*.7 if moving else 0
			joints["arm"+side].rotation.x = -wave*.65*sign if moving else -.15
			joints["forearm"+side].rotation.x = -.5

		if p.get("celebrationPose","") == "tremble" and not p.get("flight") is Dictionary:
			var shake := sin(elapsed*28+float(p.x))
			joints.body.position.x = shake*.045
			joints.body.rotation.z = shake*.035
			joints.head.rotation.z = -shake*.07
			for side in ["L","R"]:
				joints["arm"+side].rotation.x = -.5+shake*.08
				joints["forearm"+side].rotation.x = -1.1
		if p.get("celebrationPose","") == "cape" and not p.get("flight") is Dictionary:
			var sway := sin(elapsed*6+float(p.x))*float(p.get("capeWave",0))
			joints.body.rotation.z = sway*.08
			for side in ["L","R"]:
				joints["arm"+side].rotation.x = -1.1+sway*.18
				joints["forearm"+side].rotation.x = -.25
			var cape: Node3D = model.get_node("Cape")
			cape.position = Vector3(sway*.35,1.12+sway*.12,1.02)
			cape.rotation = Vector3(sway*.12,sin(elapsed*8)*.04,sway*.25)
