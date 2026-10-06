extends "res://fps.gd"

var models: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://krill-models.json"))
var whale := Node3D.new()
var jaw: Node3D
var mouth: MeshInstance3D
var danger: MeshInstance3D
var danger_rim: MeshInstance3D
var obstacles: Dictionary = {}
var reins: MeshInstance3D
var board: Label
var card_mode := false

func voxel_model(parts: Array) -> Node3D:
	var root := Node3D.new()
	var node := MultiMeshInstance3D.new()
	var multi := MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.use_colors = true
	multi.mesh = BoxMesh.new()
	multi.instance_count = parts.size()
	for i in range(parts.size()):
		var p: Dictionary = parts[i]
		multi.set_instance_transform(i,Transform3D(Basis.IDENTITY.scaled(Vector3(p.size[0],p.size[1],p.size[2])),Vector3(p.pos[0],p.pos[1],p.pos[2])))
		multi.set_instance_color(i,Color(p.color))
	node.multimesh = multi
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = .85
	node.material_override = material
	root.add_child(node)
	return root

func ellipse(color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 1
	mesh.bottom_radius = 1
	mesh.height = .012
	mesh.radial_segments = 64
	node.mesh = mesh
	node.rotation.x = PI/2
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if color.a < 1:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	node.material_override = material
	return node

func _ready() -> void:
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	for arg in OS.get_cmdline_user_args():
		if arg == "--krill-card":
			card_mode = true
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	var env := WorldEnvironment.new()
	var background := Environment.new()
	background.background_mode = Environment.BG_COLOR
	background.background_color = Color("#06293e")
	background.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	background.ambient_light_color = Color("#aee9ff")
	background.ambient_light_energy = .8
	env.environment = background
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-25,-30,0)
	sun.light_energy = .8
	add_child(sun)
	camera = Camera3D.new()
	camera.fov = 48
	camera.position = Vector3(0,0,29)
	add_child(camera)
	camera.look_at(Vector3(0,0,-3))
	add_child(whale)
	whale.position = Vector3(0,2,-17)
	whale.scale = Vector3.ONE*1.5
	whale.add_child(voxel_model(models.whale.filter(func(p):return p.name != "jaw")))
	jaw = voxel_model(models.whale.filter(func(p):return p.name == "jaw"))
	whale.add_child(jaw)
	mouth = ellipse(Color("#071422"))
	mouth.position = Vector3(0,-3.2,2.2)
	whale.add_child(mouth)
	danger = ellipse(Color(1,.65,.49,.08))
	danger.position.z = -.1
	add_child(danger)
	danger_rim = MeshInstance3D.new()
	var ring_mesh := TorusMesh.new()
	ring_mesh.inner_radius = .975
	ring_mesh.outer_radius = 1
	ring_mesh.rings = 48
	ring_mesh.ring_segments = 8
	danger_rim.mesh = ring_mesh
	danger_rim.rotation.x = PI/2
	var ring_material := StandardMaterial3D.new()
	ring_material.albedo_color = Color(1,.65,.49,.35)
	ring_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	danger_rim.material_override = ring_material
	add_child(danger_rim)
	reins = MeshInstance3D.new()
	var rope_material := StandardMaterial3D.new()
	rope_material.albedo_color = Color("#ffe7a6")
	rope_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	reins.material_override = rope_material
	add_child(reins)
	for i in range(130):
		block(self,Vector3(.05,.05,.05),Vector3(sin(i*12.7)*28,cos(i*2.3)*17,-27+(i%35)),Color("#4b879b"))
	build_ui()
	score_strip.add_child(match_clock)
	status.text = "KRILL ESCAPE · 크릴 생존"
	ranking.text = "왼쪽 패드 이동 · 오른쪽 꼬리치기 · 흡입 위험 구역에서 탈출"
	var layout: VBoxContainer = lobby.get_child(0)
	layout.get_child(0).text = "KRILL ESCAPE / 대기실"
	layout.get_child(1).text = "작은 크릴, 거대한 고래 · 개인 생존"
	teams_input.hide()
	teams_input.get_parent().get_child(0).hide()
	layout.get_child(5).text = "경기 시간 적용"
	start_button.text = "▶ 크릴 생존 시작"
	board = text_label("",18)
	board.position = Vector2(24,130)
	lobby.get_parent().add_child(board)
	fetch_config()
	if card_mode:
		set_process(false)
		lobby.get_parent().hide()
		var actor := voxel_model(models.krill)
		actor.scale = Vector3.ONE*3
		actor.position = Vector3(3,-2,4)
		add_child(actor)
		mouth.hide()
		danger.hide()
		danger_rim.hide()
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://assets/krill-card.png")
		get_tree().quit()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--krill-fixture="):
			set_process(false)
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--krill-fixture="))))
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://../.runtime/krill-pc.png")
			get_tree().quit()

func accept_state(message: Dictionary) -> void:
	if message.get("game") != "krill":
		return
	state = message
	var phase: String = message.phase
	var k: Dictionary = message.krill
	var finished := phase == "finished"
	var winners: Array = message.results.winnerIds if finished else []
	var winner: String = str(winners[0]) if winners.size() else ""
	whale.position = Vector3(k.ride.x,-2+k.ride.y,-5) if finished else Vector3(0,2,-17)
	whale.rotation.y = k.ride.yaw if finished else 0.0
	var opening: float = .08 if finished else k.get("opening",0)
	jaw.position.y = -opening*3.3
	jaw.rotation.x = opening*.12
	mouth.visible = opening > .03
	mouth.scale = Vector3(8.2,1,opening*3.5)
	mouth.position.y = -3.2-opening*1.3
	danger.visible = not finished and k.stage != "rest"
	danger.position = Vector3(k.danger.x,k.danger.y,-.1)
	danger.scale = Vector3(k.danger.r,1,k.danger.r)
	danger_rim.visible = danger.visible
	danger_rim.position = danger.position+Vector3(0,0,.2)
	danger_rim.scale = danger.scale
	var material: StandardMaterial3D = danger.material_override
	material.albedo_color.a = .14 if k.stage == "suction" else .075
	status.text = "KRILL ESCAPE · " + ("대기실" if phase == "lobby" else "흡입 중!" if k.stage == "suction" else "곧 입을 벌립니다" if k.stage == "warning" else "바다 속 생존")
	var rows := PackedStringArray()
	for p in message.players:
		if not actors.has(p.id):
			var actor := voxel_model(models.krill)
			var marker := Label3D.new()
			marker.name = "Marker"
			marker.font = FONT
			marker.font_size = 34
			marker.pixel_size = .015
			marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			marker.position.y = .65
			marker.modulate = Color(p.color)
			actor.add_child(marker)
			actors[p.id] = actor
			add_child(actor)
		var actor: Node3D = actors[p.id]
		actor.visible = p.id == winner if finished else (phase == "lobby" or (p.participating and p.alive))
		actor.position = Vector3(whale.position.x,whale.position.y+5.4,-1.5) if finished else Vector3(p.x,p.y,-p.suction*6)
		actor.rotation.z = -.25 if finished else (.45 if p.tail > 0 else 0.0)
		actor.get_node("Marker").text = "%d · %s" % [message.players.find(p)+1,p.name]
		if p.participating:
			rows.append("%s · %s · %.1f초" % [p.name,"생존" if p.alive else "탈락",p.survival])
	for id in actors.keys():
		if not message.players.any(func(p):return p.id == id):
			actors[id].queue_free()
			actors.erase(id)
	for o in k.obstacles:
		if not obstacles.has(str(o.id)):
			var root := Node3D.new()
			block(root,Vector3(o.r*2,o.r*.65,o.r),Vector3.ZERO,Color("#64889b") if o.kind == "rock" else Color("#70d6cc"))
			if o.kind == "fish":
				block(root,Vector3(o.r*.4,o.r,o.r*.3),Vector3(o.r*1.2,0,0),Color("#47a9b5"))
			obstacles[str(o.id)] = root
			add_child(root)
		obstacles[str(o.id)].position = Vector3(o.x,o.y,o.z)
		obstacles[str(o.id)].visible = not finished
	for id in obstacles.keys():
		if not k.obstacles.any(func(o):return str(o.id) == id):
			obstacles[id].queue_free()
			obstacles.erase(id)
	reins.visible = finished and not winner.is_empty()
	if reins.visible:
		var surface := SurfaceTool.new()
		surface.begin(Mesh.PRIMITIVE_LINES)
		for side in [-1,1]:
			surface.add_vertex(whale.position+Vector3(0,5.4,4))
			surface.add_vertex(whale.position+Vector3(side*7,-1,2))
		reins.mesh = surface.commit()
		status.text = "고래의 주인! · 휴대폰 패드로 고래를 조종하세요"
	board.visible = phase != "lobby"
	board.text = "\n".join(rows)
	if finished:
		board.text = "\n".join(message.results.players.map(func(p):return "%d위 · %s · %.1f초" % [p.rank,p.name,p.survival]))
		if winner.is_empty():
			status.text = "경기 종료 · 생존자 없음"
	lobby.visible = phase == "lobby"
	start_button.disabled = not authenticated or phase != "lobby" or not message.players.any(func(p):return p.connected)
	return_button.disabled = not authenticated
	time_input.editable = authenticated and phase == "lobby"
	time_input.value = message.duration
	lobby.get_child(0).get_child(5).disabled = not authenticated or phase != "lobby"
	match_clock.text = "연장전" if message.remaining == 0 and phase == "running" else "%02d:%02d" % [int(ceil(message.remaining))/60,int(ceil(message.remaining))%60]
	score_strip.visible = phase == "running"
	for child in roster.get_children():
		child.queue_free()
	for p in message.players:
		roster.add_child(text_label("%s %s" % [p.name,"●" if p.connected else "연결 끊김"],16))
	var connection := JSON.stringify(message.get("connection",{}))
	if connection != connection_signature:
		connection_signature = connection
		fetch_config()

func _process(delta: float) -> void:
	elapsed += delta
	if "--krill-capture" in OS.get_cmdline_user_args() and elapsed > 4 and state.get("game") == "krill":
		set_process(false)
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://../.runtime/krill-live.png")
		var report := FileAccess.open("res://../.runtime/krill-render.json",FileAccess.WRITE)
		report.store_string(JSON.stringify({"players":actors.size(),"qr":qr.texture != null,"phase":state.phase,"fps":Engine.get_frames_per_second()}))
		get_tree().quit()
		return
	socket.poll()
	if socket.get_ready_state() == WebSocketPeer.STATE_CLOSED and elapsed-last_connect > 2:
		last_connect = elapsed
		authenticated = false
		socket.remove_meta("joined")
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
				send_admin({"type":"game","game":"krill"})
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
