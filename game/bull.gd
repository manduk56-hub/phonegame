extends "res://fps.gd"

var bull_choice: OptionButton
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
		for tier in range(4):
			var radius := BULL_RADIUS+1.5+tier*1.6
			var seat := block(self,Vector3(2.1,.7,1.7),Vector3(sin(angle)*radius,.5+tier*.8,cos(angle)*radius),Color("#c28b5e") if tier%2 == 0 else Color("#995c42"))
			seat.rotation.y = angle
			block(self,Vector3(.35,.5,.35),Vector3(sin(angle)*radius,1.1+tier*.8,cos(angle)*radius),Color("#325777") if i%2 == 0 else Color("#ebd9a8"))
	build_ui()
	score_strip.add_child(match_clock)
	var layout: VBoxContainer = lobby.get_child(0)
	layout.get_child(0).text = "BULL RUN / 투우 대기실"
	layout.get_child(1).text = "황소 자동 전진 · 사람은 뿔을 피하세요"
	teams_input.hide()
	teams_input.get_parent().get_child(0).hide()
	layout.get_child(5).text = "경기 시간 적용"
	start_button.text = "▶ 투우 시작"
	bull_choice = OptionButton.new()
	bull_choice.item_selected.connect(func(index):send_admin({"type":"bull-choice","id":choice_ids[index]}))
	layout.add_child(bull_choice)
	layout.move_child(bull_choice,6)
	fetch_config()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--bull-fixture="):
			set_process(false)
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--bull-fixture="))))
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://../.runtime/bull-pc.png")
			get_tree().quit()

func accept_state(message: Dictionary) -> void:
	if message.get("game") != "bull":
		return
	state = message
	var phase: String = message.phase
	status.text = "BULL RUN · %s · %d초" % [{"lobby":"대기실","running":"경기 중","finished":"경기 종료"}[phase],ceil(message.remaining)]
	match_clock.text = "%02d:%02d" % [int(message.remaining)/60,int(message.remaining)%60]
	ranking.text = "황소는 모두 아웃시키면 승리 · 사람은 시간까지 생존하면 승리"
	if phase == "running":
		for p in message.players:
			if p.get("participating",false) and p.role == "human":
				ranking.text += "\n%s · %.1f초 · %s" % [p.name,p.survival,"생존" if p.alive else "아웃"]
	if phase == "finished":
		ranking.text = "황소 승리!" if message.results.winner == "bull" else "사람 승리!"
		for p in message.results.players:
			ranking.text += "\n%s · %s" % [p.name,"황소" if p.role == "bull" else "%.2f초 · %s" % [p.survival,"생존" if p.alive else "아웃"]]
	lobby.visible = phase == "lobby"
	start_button.disabled = not authenticated or phase != "lobby" or message.players.filter(func(p):return p.connected).size() < 2
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
	for p in message.players:
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
		animate_model(actor,p,phase == "running" and (p.role == "bull" and p.stun <= 0 or elapsed < float(actor.get_meta("moving_until",0))))
	for id in actors.keys():
		if not message.players.any(func(p):return p.id == id):
			actors[id].queue_free()
			actors.erase(id)

func _process(delta: float) -> void:
	elapsed += delta
	if state.get("game") == "bull":
		for p in state.players:
			if actors.has(p.id):
				var actor: Node3D = actors[p.id]
				animate_model(actor,p,state.phase == "running" and (p.role == "bull" and p.stun <= 0 or elapsed < float(actor.get_meta("moving_until",0))))
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

func solid_model(role: String) -> Node3D:
	var root := Node3D.new()
	var joints := {}
	for joint_data in model_data[role].joints:
		var joint := Node3D.new()
		joint.position = Vector3(joint_data.pos[0],joint_data.pos[1],joint_data.pos[2])
		if joint_data.parent == null:
			root.add_child(joint)
		else:
			joints[joint_data.parent].add_child(joint)
		joints[joint_data.id] = joint
	for part_data in model_data[role].parts:
		var node := MeshInstance3D.new()
		if part_data.shape == "box":
			var box_mesh := BoxMesh.new()
			box_mesh.size = Vector3(part_data.size[0],part_data.size[1],part_data.size[2])
			node.mesh = box_mesh
		elif part_data.shape == "ellipsoid":
			var sphere := SphereMesh.new()
			sphere.radius = .5
			sphere.height = 1
			sphere.radial_segments = 10
			sphere.rings = 7
			node.mesh = sphere
			node.scale = Vector3(part_data.size[0],part_data.size[1],part_data.size[2])
		else:
			var from := Vector3(part_data.from[0],part_data.from[1],part_data.from[2])
			var to := Vector3(part_data.to[0],part_data.to[1],part_data.to[2])
			var cylinder := CylinderMesh.new()
			cylinder.top_radius = part_data.r1
			cylinder.bottom_radius = part_data.r0
			cylinder.height = from.distance_to(to)
			cylinder.radial_segments = 8
			node.mesh = cylinder
			node.position = (from+to)*.5
			node.quaternion = Quaternion(Vector3.UP,(to-from).normalized())
		if part_data.shape != "segment":
			node.position = Vector3(part_data.pos[0],part_data.pos[1],part_data.pos[2])
		var material := StandardMaterial3D.new()
		material.albedo_color = Color(part_data.color)
		material.roughness = .85
		node.material_override = material
		joints[part_data.joint].add_child(node)
	root.set_meta("joints",joints)
	return root

func animate_model(actor: Node3D, p: Dictionary, moving: bool) -> void:
	var model: Node3D = actor.get_node("Model")
	var joints: Dictionary = model.get_meta("joints")
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
