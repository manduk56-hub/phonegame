extends "res://fps.gd"

var meshes: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://fishing-models.json"))
var boat := Node3D.new()
var waves: Array[Node3D] = []
var fishing_board: Label
var captures := 0
var catch_nodes := {}
var state_received_elapsed := 0.0
var ceremony_owner := ""
var ceremony_distance := 34.0
const CATCH_DURATION := 1.2
const PC_OVERVIEW_POSITION := Vector3(24,48,36)

func _ready() -> void:
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	var env := WorldEnvironment.new()
	var background := Environment.new()
	background.background_mode = Environment.BG_COLOR
	background.background_color = Color("#126477")
	background.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	background.ambient_light_color = Color("#f2ebd0")
	background.ambient_light_energy = .6
	env.environment = background
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55,-30,0)
	sun.light_energy = .8
	add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 46
	camera.position = PC_OVERVIEW_POSITION
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	block(self,Vector3(180,.1,180),Vector3(0,-.18,0),Color("#126477"))
	add_child(boat)
	boat.add_child(fishing_model(meshes.boat))
	for i in range(80):
		var a := i*2.399
		var radius := 10+sqrt(i/80.0)*25
		waves.append(block(self,Vector3(1+(i%4)*.4,.025,.07),Vector3(sin(a)*radius,.01,cos(a)*radius),Color("#3b98a4") if i%2 == 0 else Color("#268595")))
	build_ui()
	score_strip.add_child(match_clock)
	status.text = "TIDELINE · 바다 낚시"
	ranking.text = "큰 입질 → 당겨 챔질 → 물고기 방향으로 기울이기 → 시계 방향 릴 감기"
	lobby_title.text = "TIDELINE / 낚시 대기실"
	lobby_hint.text = "가로 폰 · 챔질 모션 · 원형 릴 감기"
	teams_input.hide()
	teams_input.value = 4
	teams_input.get_parent().get_child(0).hide()
	configure_button.text = "경기 시간 적용"
	start_button.text = "▶ 낚시 시작"
	fishing_board = text_label("",17)
	fishing_board.position = Vector2(24,108)
	lobby.get_parent().add_child(fishing_board)
	fetch_config()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--fishing-fixture="):
			set_process(false)
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--fishing-fixture="))))
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://../.runtime/fishing-pc.png")
			get_tree().quit()

func disk(parent: Node3D, radius: float, height: float, y: float, color: String) -> void:
	var b := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 48
	b.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(color)
	b.material_override = material
	b.position.y = y
	parent.add_child(b)

func fishing_model(parts: Array, color := Color("#edbc56")) -> Node3D:
	var root := Node3D.new()
	# Merge rigid colored blocks into one mesh per material.
	var groups := {}
	for part in parts:
		var tint: String = part.color
		if not groups.has(tint):
			groups[tint] = []
		groups[tint].append(part)
	for tint in groups:
		var surface := SurfaceTool.new()
		surface.begin(Mesh.PRIMITIVE_TRIANGLES)
		for part in groups[tint]:
			var cube := BoxMesh.new()
			cube.size = Vector3(part.size[0],part.size[1],part.size[2])
			var rot := Basis.from_euler(Vector3(part.rotation[0],part.rotation[1],part.rotation[2]))
			surface.append_from(cube,0,Transform3D(rot,Vector3(part.pos[0],part.pos[1],part.pos[2])))
		var instance := MeshInstance3D.new()
		instance.mesh = surface.commit()
		var material := StandardMaterial3D.new()
		material.albedo_color = color if tint == "@color" else Color(tint)
		instance.material_override = material
		root.add_child(instance)
	return root

func create_angler(p: Dictionary) -> Node3D:
	var root := Node3D.new()
	root.name = "Angler"
	var body := fishing_model(meshes.actor,Color(p.color))
	body.name = "Body"
	root.add_child(body)
	var rod := fishing_model(meshes.rod)
	rod.name = "Rod"
	rod.position = Vector3(.1,1.18,.62)
	body.add_child(rod)
	var marker := Label3D.new()
	marker.name = "Marker"
	marker.font = FONT
	marker.font_size = 40
	marker.pixel_size = .021
	marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	marker.position.y = 3.3
	marker.modulate = Color(p.color)
	marker.outline_modulate = Color("#152e39")
	marker.outline_size = 10
	root.add_child(marker)
	var float_node := Node3D.new()
	block(float_node,Vector3(.18,.23,.18),Vector3(0,.12,0),Color("#fff4ce"))
	block(float_node,Vector3(.18,.23,.18),Vector3(0,.35,0),Color("#ed533d"))
	block(float_node,Vector3(.05,.35,.05),Vector3(0,.61,0),Color("#273b40"))
	add_child(float_node)
	root.set_meta("float",float_node)
	var fish := fishing_model(meshes.fishModels[p.fishing.species])
	root.set_meta("species",p.fishing.species)
	add_child(fish)
	root.set_meta("fish",fish)
	var line := MeshInstance3D.new()
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(p.color)
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	line.material_override = material
	add_child(line)
	root.set_meta("line",line)
	return root

func accept_state(message: Dictionary) -> void:
	if message.get("game") != "fishing":
		return
	state = message
	state_received_elapsed = elapsed
	var phase: String = message.phase
	status.text = "TIDELINE · %s · %d초" % [{"lobby":"대기실","running":"낚시 중","finished":"경기 종료"}[phase],ceil(message.remaining)]
	var sorted: Array = message.players.duplicate()
	sorted.sort_custom(func(a,b):return a.caught > b.caught)
	var rows := PackedStringArray()
	for p in sorted:
		if phase == "lobby" or p.participating:
			var f: Dictionary = p.fishing
			var detail := ""
			if f.stage == "fighting":
				var species: Array = message.fishing.species.filter(func(s):return s.id == f.species)
				if species.size():
					detail = species[0].name+" · "
			if f.stage == "bite":
				detail = "입질! 챔질하세요"
			elif f.stage == "fighting":
				detail += "%s · 힘 %d%% · 줄 %d%% · %dm" % ["← 왼쪽" if f.direction < 0 else "오른쪽 →",round(f.energy*100),round(f.tension*100),ceil(f.distance)]
			else:
				detail = f.message
			rows.append("%d · %s  %d마리  /  %s" % [message.players.find(p)+1,p.name,p.caught,detail])
	fishing_board.text = "\n".join(rows)
	fishing_board.visible = phase != "lobby"
	if phase == "finished":
		var winners := PackedStringArray()
		for p in message.results.players:
			if message.results.winnerIds.has(p.id):
				winners.append(p.name)
		status.text += " · " + (" · ".join(winners)+" 우승!" if winners.size() else "무승부")
		fishing_board.text = "\n".join(message.results.players.map(func(p):return "%d위 · %s · %d마리" % [p.rank,p.name,p.score]))
		var ceremony: Dictionary = message.fishing.get("ceremony",{}) if message.fishing.get("ceremony") != null else {}
		if not ceremony.is_empty():
			ranking.text = {"ready":"우승자: 던지기 → 폰을 당겨 카메라 낚아채기 → 원형 릴 감기", "casting":"우승자가 카메라를 향해 던지는 중", "bite":"폰 윗부분을 몸 안쪽으로 당겨 카메라를 낚아채세요!", "reeling":"우승자가 릴을 감아 카메라를 당기고 있습니다", "close":"우승자의 얼굴까지 도착! 던지기로 다시 연출할 수 있습니다"}.get(ceremony.stage,"")
	else:
		ranking.text = "큰 입질 → 당겨 챔질 → 물고기 방향으로 기울이기 → 시계 방향 릴 감기"
	preload("res://lobby_ui.gd").sync(lobby,phase)
	start_button.disabled = not authenticated or phase != "lobby" or not message.players.any(func(p):return p.connected)
	return_button.disabled = not authenticated
	time_input.editable = authenticated and phase == "lobby"
	time_input.value = message.duration
	var configure: Button = configure_button
	configure.disabled = not authenticated or phase != "lobby"
	match_clock.text = "%02d:%02d" % [int(ceil(message.remaining))/60,int(ceil(message.remaining))%60]
	score_strip.visible = phase == "running"
	score_strip.position.x = (get_viewport().get_visible_rect().size.x-score_strip.size.x)/2
	var roster_key := JSON.stringify(message.players.map(func(p):return [p.id,p.name,p.connected,p.color]))
	if roster.get_meta("signature","") != roster_key:
		roster.set_meta("signature",roster_key)
		for child in roster.get_children():
			child.queue_free()
		for p in message.players:
			roster.add_child(text_label("%s %s" % [p.name,"●" if p.connected else "연결 끊김"],16))
	for p in message.players:
		if not actors.has(p.id):
			actors[p.id] = create_angler(p)
			add_child(actors[p.id])
		var actor: Node3D = actors[p.id]
		actor.position = Vector3(p.x,p.y,p.z)
		actor.rotation.y = p.yaw
		actor.visible = phase == "lobby" or p.participating
		actor.get_node("Marker").text = "%d · %s · %d" % [message.players.find(p)+1,p.name,p.caught]
		actor.get_node("Marker").visible = phase != "finished"
		var f: Dictionary = p.fishing
		actor.get_node("Body").rotation.z = f.direction*.09 if f.stage == "fighting" else 0
		actor.get_node("Body/Rod").rotation.x = -.65 if f.stage == "casting" else (-.18 if f.stage == "fighting" else 0.0)
		var float_node: Node3D = actor.get_meta("float")
		float_node.visible = f.stage in ["casting","waiting","bite","fighting"]
		float_node.position = Vector3(f.fishX,.12+f.bob,f.fishZ)
		if actor.get_meta("species") != f.species:
			actor.get_meta("fish").queue_free()
			var replacement := fishing_model(meshes.fishModels[f.species])
			add_child(replacement)
			actor.set_meta("fish",replacement)
			actor.set_meta("species",f.species)
		var fish: Node3D = actor.get_meta("fish")
		fish.visible = f.stage == "fighting"
		fish.position = Vector3(f.fishX,.24,f.fishZ)
		fish.scale = Vector3.ONE*.62
		fish.rotation.y = f.direction*PI/2
		var line: MeshInstance3D = actor.get_meta("line")
		line.visible = float_node.visible
		var surface := SurfaceTool.new()
		surface.begin(Mesh.PRIMITIVE_LINES)
		surface.add_vertex(actor.get_node("Body/Rod").to_global(Vector3(0,1.35,3.36)))
		surface.add_vertex(float_node.position)
		line.mesh = surface.commit()
	for id in actors.keys():
		if not message.players.any(func(p):return p.id == id):
			for key in ["float","fish","line"]:
				actors[id].get_meta(key).queue_free()
			actors[id].queue_free()
			actors.erase(id)
	var events: Array = message.fishing.get("catches",[])
	var visible: Array = events.filter(func(e):return message.fishing.elapsed-e.at < CATCH_DURATION)
	var landed: Array = events.filter(func(e):return message.fishing.elapsed-e.at >= CATCH_DURATION)
	visible.append_array(landed.slice(maxi(0,landed.size()-20)))
	for event in visible:
		if not catch_nodes.has(event.id):
			var caught_fish := fishing_model(meshes.fishModels[event.species])
			add_child(caught_fish)
			catch_nodes[event.id] = {"node":caught_fish,"event":event}
	for id in catch_nodes.keys():
		if not visible.any(func(e):return e.id == id):
			catch_nodes[id].node.queue_free()
			catch_nodes.erase(id)
	animate_effects()
	var connection := JSON.stringify(message.get("connection",{}))
	if connection != connection_signature:
		connection_signature = connection
		fetch_config()

func animate_effects(delta := 0.0) -> void:
	if state.get("game") != "fishing":
		return
	var effect_time: float = state.fishing.elapsed+minf(.15,elapsed-state_received_elapsed)
	for value in catch_nodes.values():
		var event: Dictionary = value.event
		var age: float = maxf(0,effect_time-event.at)
		var t := clampf((age-.2)/(CATCH_DURATION-.2),0,1)
		var slot := int(event.id)%20
		var end := Vector3((slot%5-2)*.48,1.22+floor((int(event.id)%60)/20.0)*.08,(int(slot/5)-1.5)*.42)
		var from := Vector3(event.from[0],event.from[1],event.from[2])
		var node: Node3D = value.node
		node.position = from.lerp(end,t)+Vector3(0,4*3.2*t*(1-t),0)
		node.rotation = Vector3(t*TAU,event.yaw+t*PI,sin(t*PI)*.5)
		node.scale = Vector3.ONE*(.28 if age >= CATCH_DURATION else .5)
	for id in actors:
		var actor: Node3D = actors[id]
		actor.get_node("Body").rotation.y = 0
		actor.get_node("Body/Rod").visible = true
		for event in state.fishing.get("catches",[]):
			if event.playerId == id and effect_time-event.at >= 0 and effect_time-event.at < CATCH_DURATION:
				var swing := sin(PI*(effect_time-event.at)/CATCH_DURATION)
				actor.get_node("Body").rotation.y = PI*swing
				actor.get_node("Body").rotation.z = -.15*swing
				actor.get_node("Body/Rod").rotation.x = -1.1*swing
	var ceremony = state.fishing.get("ceremony") if state.phase == "finished" else null
	if ceremony != null:
		for p in state.players:
			if p.id == ceremony.id:
				actors[p.id].get_node("Body").rotation.z = -.04 if ceremony.stage == "reeling" else 0.0
				actors[p.id].get_node("Body/Rod").rotation.x = -.65 if ceremony.stage == "casting" else (-.18 if ceremony.stage == "reeling" else 0.0)
				actors[p.id].get_node("Body/Rod").visible = ceremony.distance > 3
				if ceremony_owner != str(p.id):
					ceremony_owner = str(p.id)
					ceremony_distance = ceremony.distance
				ceremony_distance = lerpf(ceremony_distance,ceremony.distance,1-exp(-delta*10))
				var distance := clampf(ceremony_distance,1.8,34)
				var face := Vector3(p.x,p.y+2.22,p.z)
				camera.projection = Camera3D.PROJECTION_PERSPECTIVE
				camera.fov = 48
				camera.position = face+Vector3(sin(p.yaw)*distance,distance*.24*minf(1,(distance-1.8)/8),cos(p.yaw)*distance)
				camera.look_at(face)
	else:
		ceremony_owner = ""
		camera.projection = Camera3D.PROJECTION_ORTHOGONAL
		camera.size = 46
		camera.position = PC_OVERVIEW_POSITION
		camera.look_at(Vector3.ZERO)

func _process(delta: float) -> void:
	elapsed += delta
	animate_effects(delta)
	if "--fishing-capture" in OS.get_cmdline_user_args() and elapsed > 4 and state.get("game") == "fishing":
		set_process(false)
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://../.runtime/fishing-live.png")
		var report := FileAccess.open("res://../.runtime/fishing-render.json",FileAccess.WRITE)
		report.store_string(JSON.stringify({"game":"fishing","players":actors.size(),"qr":qr.texture != null,"phase":state.phase,"fps":Engine.get_frames_per_second()}))
		get_tree().quit()
		return
	boat.position.y = sin(elapsed*.75)*.04
	for i in range(waves.size()):
		waves[i].position.x += sin(elapsed*.4+i)*delta*.12
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
				send_admin({"type":"game","game":"fishing"})
			elif message.type == "state" and authenticated:
				accept_state(message)
			elif message.type == "error":
				status.text = message.message
	elif elapsed-last_config > 3:
		fetch_config()

func _exit_tree() -> void:
	socket.close()
	for unused in [bases,flag,flag_banner,flag_pickup]:
		if is_instance_valid(unused) and unused.get_parent() == null:
			unused.free()
