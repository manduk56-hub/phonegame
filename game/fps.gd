extends Node3D

const FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")
var arena: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://fps-arena.json"))
var art: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://fps-art.json"))
var art_materials: Dictionary = {}
var state: Dictionary = {}
var socket := WebSocketPeer.new()
var server_url := "http://127.0.0.1:3000"
var admin_key := ""
var authenticated := false
var elapsed := 0.0
var last_connect := -5.0
var last_config := -5.0
var config_pending := false
var connection_signature := ""
var camera: Camera3D
var status: Label
var ranking: Label
var roster: VBoxContainer
var join_label: Label
var qr: TextureRect
var lobby: PanelContainer
var start_button: Button
var return_button: Button
var teams_input: SpinBox
var time_input: SpinBox
var bases := Node3D.new()
var actors: Dictionary = {}
var flag := Node3D.new()
var flag_banner := Node3D.new()
var flag_pickup := Node3D.new()
var flag_label: Label3D
var base_signature := ""

func block(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	node.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	node.material_override = mat
	node.position = pos
	parent.add_child(node)
	return node

func text_label(text: String, font_size := 20) -> Label:
	var result := Label.new()
	result.text = text
	result.add_theme_font_size_override("font_size",font_size)
	return result

func _ready() -> void:
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#adb9bc")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#e6f6ff")
	environment.ambient_light_energy = .4
	env.environment = environment
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55,-30,0)
	sun.shadow_enabled = true
	sun.light_color = Color("#ffefcc")
	sun.light_energy = .7
	add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 60
	camera.position = Vector3(34,40,42)
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	prepare_art()
	var floor_mesh := block(self,Vector3(66,.2,66),Vector3(0,-.1,0),Color("#827e63"))
	var floor_material: StandardMaterial3D = art_materials.ground.duplicate()
	floor_material.uv1_scale = Vector3(22,22,1)
	floor_mesh.material_override = floor_material
	add_child(art_model(art.world))
	add_child(bases)
	add_child(flag)
	build_flag()
	build_ui()
	fetch_config()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--fps-fixture="):
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--fps-fixture="))))
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://../.runtime/fps-pc.png")
			get_tree().quit()

func build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var ui := Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme_resource := Theme.new()
	theme_resource.default_font = FONT
	ui.theme = theme_resource
	layer.add_child(ui)
	status = text_label("FLAG STRIKE · 서버 연결 중",28)
	status.position = Vector2(24,22)
	ui.add_child(status)
	ranking = text_label("중앙 깃발 → 우리 진영 · 사망 2초 뒤 제자리 부활",18)
	ranking.position = Vector2(24,62)
	ui.add_child(ranking)
	lobby = PanelContainer.new()
	lobby.position = Vector2(35,145)
	lobby.custom_minimum_size = Vector2(420,560)
	ui.add_child(lobby)
	var layout := VBoxContainer.new()
	lobby.add_child(layout)
	layout.add_child(text_label("깃발 쟁탈전 / 대기실",28))
	layout.add_child(text_label("왼손 이동 · 오른손 드래그 조준 · 발사",18))
	qr = TextureRect.new()
	qr.custom_minimum_size = Vector2(130,130)
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	qr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	layout.add_child(qr)
	join_label = text_label("폰 접속 주소 확인 중",14)
	layout.add_child(join_label)
	var row := HBoxContainer.new()
	layout.add_child(row)
	row.add_child(text_label("팀 수",18))
	teams_input = SpinBox.new()
	teams_input.min_value = 2
	teams_input.max_value = 8
	teams_input.value = 4
	row.add_child(teams_input)
	row.add_child(text_label("시간(초)",18))
	time_input = SpinBox.new()
	time_input.min_value = 30
	time_input.max_value = 900
	time_input.value = 180
	row.add_child(time_input)
	var configure := Button.new()
	configure.text = "팀 수/시간 적용 · 균등 배정"
	configure.pressed.connect(func():
		teams_input.apply()
		time_input.apply()
		send_admin({"type":"configure","teams":int(teams_input.value),"duration":time_input.value})
	)
	layout.add_child(configure)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size.y = 155
	layout.add_child(scroll)
	roster = VBoxContainer.new()
	scroll.add_child(roster)
	start_button = Button.new()
	start_button.text = "▶ 깃발 쟁탈전 시작"
	start_button.pressed.connect(func():send_admin({"type":"start"}))
	layout.add_child(start_button)
	return_button = Button.new()
	return_button.text = "대기실로 돌아가기"
	return_button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	return_button.offset_left = -270
	return_button.offset_top = -65
	return_button.offset_right = -20
	return_button.offset_bottom = -20
	return_button.pressed.connect(func():send_admin({"type":"lobby"}))
	ui.add_child(return_button)
	start_button.disabled = true
	return_button.disabled = true

func accept_state(message: Dictionary) -> void:
	state = message
	if message.game != "fps":
		return
	var signature := JSON.stringify(message.teams)
	# Only geometry changes rebuild team bases; score changes remain in the HUD.
	var positions := []
	for team in message.teams:
		positions.append([team.id,team.color,team.x,team.z])
	signature = JSON.stringify(positions)
	if signature != base_signature:
		for node in bases.get_children():
			node.queue_free()
		for team in message.teams:
			block(bases,Vector3(5,.12,5),Vector3(team.x,.06,team.z),Color(team.color))
			var marker := Label3D.new()
			marker.pixel_size = .035
			marker.text = "팀 %d 진영" % (int(team.id)+1)
			marker.font = FONT
			marker.position = Vector3(team.x,2,team.z)
			marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			bases.add_child(marker)
		base_signature = signature
	var present := {}
	for index in range(message.players.size()):
		var p: Dictionary = message.players[index]
		present[p.id] = true
		if not actors.has(p.id):
			var root := Node3D.new()
			add_child(root)
			var body := art_model(art.actor,Color(message.teams[p.team].color))
			body.name = "Soldier"
			root.add_child(body)
			var rifle := art_model(art.rifle)
			rifle.scale = Vector3.ONE*.6
			rifle.position = Vector3(.03,1.09,.21)
			root.add_child(rifle)
			var marker := Label3D.new()
			marker.font = FONT
			marker.pixel_size = .035
			marker.name = "PlayerMarker"
			marker.position.y = 2.6
			marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			root.add_child(marker)
			actors[p.id] = root
		var actor: Node3D = actors[p.id]
		actor.position = Vector3(p.x,0,p.z)
		actor.rotation.y = p.yaw
		actor.visible = p.connected
		actor.scale.y = 1.0 if p.hp > 0 else .15
		actor.get_node("Soldier/TeamArmor").material_override.albedo_color = Color(message.teams[p.team].color)
		actor.get_node("PlayerMarker").text = "%d · %s · HP %d" % [index+1,p.name,p.hp]
	for id in actors.keys():
		if not present.has(id):
			actors[id].queue_free()
			actors.erase(id)
	var carrying: bool = message.fps.flag.carrier != null
	var flag_point := Vector3(message.fps.flag.x,2.2 if carrying else 0,message.fps.flag.z)
	for player in message.players:
		if player.id == message.fps.flag.carrier:
			flag_point.x = player.x
			flag_point.z = player.z
	flag.position = flag_point
	flag.get_node("FlagPole").scale.y = .5 if carrying else 1
	flag.get_node("FlagPole").position.y = .9 if carrying else 1.8
	flag_banner.position.y = .9 if carrying else 3.05
	flag.get_node("Pedestal").visible = not carrying
	flag_label.visible = not carrying
	flag_pickup.visible = not carrying
	flag_pickup.position = Vector3(message.fps.flag.x,0,message.fps.flag.z)
	var radius: float = message.fps.flag.get("pickupRadius",2.5)
	flag_pickup.scale = Vector3(radius,1,radius)
	status.text = "FLAG STRIKE · %s · %d초" % [{"lobby":"대기실","running":"경기 중","finished":"경기 종료"}[message.phase],ceil(message.remaining)]
	var scores := PackedStringArray()
	for team in message.teams:
		scores.append("팀 %d : %d점" % [int(team.id)+1,team.captures])
	ranking.text = "  /  ".join(scores)
	if message.phase == "finished":
		var winners := PackedStringArray()
		for id in message.results.winnerIds:
			winners.append("팀 %d" % (int(id)+1))
		status.text += " · " + (" / ".join(winners)+" 우승!" if winners.size() > 0 else "무승부")
	lobby.visible = message.phase == "lobby"
	start_button.disabled = not authenticated or message.phase != "lobby" or not message.players.any(func(p):return p.connected)
	return_button.disabled = not authenticated
	var roster_signature := JSON.stringify([message.teamCount,message.players.map(func(p):return [p.id,p.name,p.team,p.connected])])
	if roster.get_meta("signature","") != roster_signature:
		roster.set_meta("signature",roster_signature)
		for child in roster.get_children():
			child.queue_free()
		for p in message.players:
			var row := HBoxContainer.new()
			roster.add_child(row)
			row.add_child(text_label(str(p.name)+(" ●" if p.connected else " 오프라인"),16))
			var choice := OptionButton.new()
			for team in message.teams:
				choice.add_item("팀 %d" % (int(team.id)+1))
			choice.select(p.team)
			choice.item_selected.connect(func(team):send_admin({"type":"assign","id":p.id,"team":team}))
			row.add_child(choice)
	var connection := JSON.stringify(message.get("connection",{}))
	if connection != connection_signature:
		connection_signature = connection
		fetch_config()

func _process(delta: float) -> void:
	elapsed += delta
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
				send_admin({"type":"game","game":"fps"})
			elif message.type == "state" and authenticated:
				accept_state(message)
			elif message.type == "error":
				status.text = message.message
	elif elapsed-last_config > 3:
		fetch_config()
	flag.rotation.y = atan2(camera.position.x-flag.position.x,camera.position.z-flag.position.z)

func _exit_tree() -> void:
	socket.close()

func send_admin(message: Dictionary) -> void:
	if authenticated and socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(message))

func fetch_config() -> void:
	if config_pending:
		return
	config_pending = true
	last_config = elapsed
	var request := HTTPRequest.new()
	request.timeout = 4
	add_child(request)
	request.request_completed.connect(func(_result,code,_headers,body):
		config_pending = false
		if code == 200:
			var config = JSON.parse_string(body.get_string_from_utf8())
			if config is Dictionary and config.get("app") == "dirt-rally":
				admin_key = OS.get_environment("DIRT_RALLY_HOST_KEY") if config.get("hostAuth") == "token" else str(config.get("adminKey",""))
				join_label.text = "참가 코드 %s\n%s" % [config.room,config.joinAddress]
				load_qr()
		request.queue_free()
	)
	if request.request(server_url+"/config") != OK:
		config_pending = false
		request.queue_free()

func load_qr() -> void:
	var request := HTTPRequest.new()
	add_child(request)
	request.request_completed.connect(func(_result,code,_headers,body):
		if code == 200:
			var image := Image.new()
			if image.load_svg_from_buffer(body) == OK:
				qr.texture = ImageTexture.create_from_image(image)
		request.queue_free()
	)
	request.request(server_url+"/qr")


func prepare_art() -> void:
	var outline := ShaderMaterial.new()
	var outline_shader := Shader.new()
	outline_shader.code = "shader_type spatial; render_mode unshaded, cull_front; void vertex(){VERTEX += NORMAL * 0.015;} void fragment(){ALBEDO = vec3(0.12,0.14,0.13);}"
	outline.shader = outline_shader
	for key in art.textures:
		var texture: Dictionary = art.textures[key]
		var image := Image.create_from_data(int(texture.size),int(texture.size),false,Image.FORMAT_RGBA8,PackedByteArray(texture.pixels))
		var material := StandardMaterial3D.new()
		material.albedo_texture = ImageTexture.create_from_image(image)
		material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		material.roughness = 1
		material.albedo_color = Color(.78,.78,.78)
		material.next_pass = outline
		art_materials[key] = material

func art_model(parts: Array, team_color := Color.WHITE) -> Node3D:
	var root := Node3D.new()
	var groups := {}
	for part in parts:
		if not groups.has(part.mat):
			groups[part.mat] = []
		groups[part.mat].append(part)
	for key in groups:
		var instance := MultiMeshInstance3D.new()
		var multi := MultiMesh.new()
		multi.transform_format = MultiMesh.TRANSFORM_3D
		var mesh := BoxMesh.new()
		mesh.size = Vector3.ONE
		multi.mesh = mesh
		multi.instance_count = groups[key].size()
		for index in range(groups[key].size()):
			var part: Dictionary = groups[key][index]
			var basis := Basis.from_euler(Vector3(part.rot[0],part.rot[1],part.rot[2]))
			basis = basis.scaled_local(Vector3(part.size[0],part.size[1],part.size[2]))
			multi.set_instance_transform(index,Transform3D(basis,Vector3(part.pos[0],part.pos[1],part.pos[2])))
		instance.multimesh = multi
		if key == "team":
			instance.name = "TeamArmor"
			var team_material: StandardMaterial3D = art_materials[key].duplicate()
			team_material.albedo_color = team_color
			instance.material_override = team_material
		else:
			instance.material_override = art_materials[key]
		root.add_child(instance)
	return root

func bright_block(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mesh := block(parent,size,pos,color)
	mesh.material_override.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mesh

func build_flag() -> void:
	var pole := bright_block(flag,Vector3(.12,3.6,.12),Vector3(-.95,1.8,0),Color("#fff4bf"))
	pole.name = "FlagPole"
	flag.add_child(flag_banner)
	flag_banner.position.y = 3.05
	bright_block(flag_banner,Vector3(2.7,1.4,.09),Vector3(.35,0,0),Color("#352500"))
	bright_block(flag_banner,Vector3(2.6,1.3,.12),Vector3(.35,0,0),Color("#ffdc19"))
	bright_block(flag_banner,Vector3(.16,1.3,.14),Vector3(-.25,0,0),Color.WHITE)
	bright_block(flag_banner,Vector3(2.6,.14,.14),Vector3(.35,0,0),Color.WHITE)
	var pedestal := bright_block(flag,Vector3(.8,.15,.8),Vector3(0,.075,0),Color("#ffdc19"))
	pedestal.name = "Pedestal"
	flag_label = Label3D.new()
	flag_label.font = FONT
	flag_label.font_size = 48
	flag_label.pixel_size = .025
	flag_label.text = "깃발 · 원 안에서 자동 획득"
	flag_label.modulate = Color("#ffe83e")
	flag_label.position.y = 4.2
	flag_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	flag.add_child(flag_label)
	add_child(flag_pickup)
	var beacon := bright_block(flag_pickup,Vector3(.07,3.6,.07),Vector3(0,1.8,0),Color("#ffe83e"))
	beacon.material_override.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	beacon.material_override.albedo_color.a = .3
	var disc := MeshInstance3D.new()
	var disc_mesh := CylinderMesh.new()
	disc_mesh.top_radius = 1
	disc_mesh.bottom_radius = 1
	disc_mesh.height = .02
	disc_mesh.radial_segments = 64
	disc.mesh = disc_mesh
	var translucent := StandardMaterial3D.new()
	translucent.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	translucent.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	translucent.albedo_color = Color(1,.81,.1,.2)
	disc.material_override = translucent
	disc.position.y = .035
	disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flag_pickup.add_child(disc)
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = .95
	torus.outer_radius = 1
	torus.rings = 64
	torus.ring_segments = 8
	ring.mesh = torus
	var yellow := StandardMaterial3D.new()
	yellow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	yellow.albedo_color = Color("#ffe83e")
	ring.material_override = yellow
	ring.position.y = .08
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flag_pickup.add_child(ring)
