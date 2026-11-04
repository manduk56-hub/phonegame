extends "res://fps.gd"

var field := Node3D.new()
var field_round := -1
var fixture := false
var capture_frames := 0

func _ready() -> void:
	server_url = OS.get_environment("DIRT_RALLY_SERVER_URL") if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty() else server_url
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	var env := WorldEnvironment.new()
	var lighting := Environment.new()
	lighting.background_mode = Environment.BG_COLOR
	lighting.background_color = Color("#b8cda5")
	lighting.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	lighting.ambient_light_color = Color("#fff3d3")
	lighting.ambient_light_energy = .7
	env.environment = lighting
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-65,-25,0)
	add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 23
	camera.position = Vector3(0,30,13)
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	block(self,Vector3(24.5,.2,18.5),Vector3(0,-.13,0),Color("#648748"))
	for z in [-9.2,9.2]:
		block(self,Vector3(24.6,.12,.2),Vector3(0,.02,z),Color("#cfbe8f"))
	for x in [-12.2,12.2]:
		block(self,Vector3(.2,.12,18.6),Vector3(x,.02,0),Color("#cfbe8f"))
	add_child(field)
	build_ui()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--clover-fixture="):
			fixture = true
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--clover-fixture="))))
	if not fixture:
		fetch_config()

func build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var ui := Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ui_theme := Theme.new()
	ui_theme.default_font = FONT
	preload("res://pixel_ui.gd").apply(ui_theme)
	ui.theme = ui_theme
	layer.add_child(ui)
	status = text_label("LUCKY CLOVER · 서버 연결 중",26)
	status.position = Vector2(24,20)
	ui.add_child(status)
	ranking = text_label("PC에서 내 번호 확인",18)
	ranking.position = Vector2(24,105)
	ranking.custom_minimum_size.x = 270
	ui.add_child(ranking)
	lobby = PanelContainer.new()
	ui.add_child(lobby)
	var layout := VBoxContainer.new()
	lobby.add_child(layout)
	layout.add_child(text_label("LUCKY CLOVER · 네잎클로버 찾기",30))
	layout.add_child(text_label("PC에서 네 장의 잎과 내 번호를 찾으세요.\n휴대폰은 1인칭 · 이동 패드는 PC 화면 방향\n먼저 뽑으면 1점! 2.4초 뒤 새 들판이 시작됩니다.",20))
	time_input = SpinBox.new()
	time_input.min_value = 30
	time_input.max_value = 900
	time_input.value = 180
	time_input.step = 30
	time_input.suffix = "초"
	layout.add_child(time_input)
	configure_button = Button.new()
	configure_button.text = "경기 시간 적용"
	configure_button.pressed.connect(func():send_admin({"type":"configure","teams":state.get("teamCount",4),"duration":time_input.value}))
	layout.add_child(configure_button)
	qr = TextureRect.new()
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	qr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	layout.add_child(qr)
	join_label = text_label("QR 연결 중",16)
	layout.add_child(join_label)
	roster = VBoxContainer.new()
	layout.add_child(roster)
	start_button = Button.new()
	start_button.text = "▶ 클로버 찾기 시작 · 1–16명"
	start_button.disabled = true
	start_button.pressed.connect(func():send_admin({"type":"start"}))
	layout.add_child(start_button)
	return_button = Button.new()
	return_button.text = "대기실로 돌아가기"
	return_button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	return_button.offset_left = -270
	return_button.offset_right = -20
	return_button.offset_top = -65
	return_button.offset_bottom = -20
	return_button.pressed.connect(func():send_admin({"type":"lobby"}))
	ui.add_child(return_button)
	preload("res://lobby_ui.gd").setup(ui,lobby,qr,join_label,start_button,roster)

func leaf(parent: Node3D, pos: Vector3, angle: float) -> void:
	var node := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = .2
	mesh.height = .4
	mesh.radial_segments = 10
	mesh.rings = 4
	node.mesh = mesh
	node.scale = Vector3(.85,.16,1.2)
	node.position = pos
	node.rotation.y = angle
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#2e7340")
	node.material_override = material
	parent.add_child(node)
	var vein := block(parent,Vector3(.012,.01,.29),pos+Vector3(0,.034,0),Color("#b1ca7d"))
	vein.rotation.y = angle

func accept_state(message: Dictionary) -> void:
	if message.get("game") != "clover":
		return
	state = message
	var s: Dictionary = message.clover
	if field_round != int(s.round):
		field_round = int(s.round)
		for child in field.get_children():
			child.queue_free()
		for p in s.plants:
			var count := 4 if int(p.id) == int(s.target) else 3
			for j in range(count):
				var a: float = j*TAU/count+float(p.get("angle",.35))
				leaf(field,Vector3(p.x+sin(a)*.23,.1,p.z+cos(a)*.23),a)
	var connected := 0
	var scores := PackedStringArray()
	for p in message.players:
		if not actors.has(p.id):
			var body := Node3D.new()
			add_child(body)
			block(body,Vector3(.48,.7,.36),Vector3(0,.7,0),Color(p.color))
			block(body,Vector3(.38,.38,.38),Vector3(0,1.24,0),Color("#e8bf96"))
			var number := Label3D.new()
			number.text = str(int(p.number))
			number.font = FONT
			number.font_size = 56
			number.pixel_size = .014
			number.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			number.no_depth_test = true
			number.position.y = 2
			number.modulate = Color(p.color)
			body.add_child(number)
			actors[p.id] = body
		var actor: Node3D = actors[p.id]
		actor.position = Vector3(p.x,0,p.z)
		actor.scale.y = .55 if p.crouching else 1.0
		actor.visible = p.connected
		if p.connected:
			connected += 1
		scores.append("%d · %s · %d점" % [int(p.number),p.name,p.clovers])
	for id in actors.keys():
		if not message.players.any(func(p):return p.id == id):
			actors[id].queue_free()
			actors.erase(id)
	status.text = "LUCKY CLOVER · %d초 · 라운드 %d" % [ceili(message.remaining),s.round]
	ranking.text = "\n".join(scores)
	if float(s.reset) > 0:
		status.text = "%s 발견! +1점 · 새 들판 준비 중" % s.winner.name
	if message.phase == "finished":
		status.text = "LUCKY CLOVER · 경기 종료"
		var results := PackedStringArray()
		for p in message.results.players:
			results.append("%d위 %s %d점" % [p.rank,p.name,p.score])
		ranking.text = "\n".join(results)
	start_button.disabled = not authenticated or message.phase != "lobby" or connected == 0
	return_button.disabled = not authenticated or message.phase == "lobby"
	configure_button.disabled = message.phase != "lobby"
	time_input.editable = message.phase == "lobby"
	preload("res://lobby_ui.gd").sync(lobby,message.phase)
	for child in roster.get_children():
		child.queue_free()
	for p in message.players:
		roster.add_child(text_label("%s · %s%s" % [p.number,p.name,"" if p.connected else " (연결 끊김)"],18))
	var connection := JSON.stringify(message.get("connection",{}))
	if connection != connection_signature and not fixture:
		connection_signature = connection
		fetch_config()

func _process(delta: float) -> void:
	elapsed += delta
	camera.size = maxf(23,28/get_viewport().get_visible_rect().size.aspect())
	if fixture:
		capture_frames += 1
		if capture_frames == 10:
			get_viewport().get_texture().get_image().save_png("res://../.runtime/clover-pc.png")
			get_tree().quit()
		return
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
				send_admin({"type":"game","game":"clover"})
			elif message.type == "state" and authenticated:
				accept_state(message)
			elif message.type == "error":
				status.text = message.message
