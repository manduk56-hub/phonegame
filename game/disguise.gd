extends "res://fps.gd"

var map_geometry := Node3D.new()
var map_id := ""
var map_picker: OptionButton
var curtain: ColorRect
var signals := Node3D.new()
var capture_frames := 0
var fixture_mode := false
var attack_layer := Node3D.new()
var mechanic_geometry := Node3D.new()
var mechanic_signature := ""
var train_node: Node3D

func _ready() -> void:
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	var env := WorldEnvironment.new()
	var light_env := Environment.new()
	light_env.background_mode = Environment.BG_COLOR
	light_env.background_color = Color("#182b32")
	light_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	light_env.ambient_light_color = Color("#e2eaf0")
	light_env.ambient_light_energy = .65
	env.environment = light_env
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55,-30,0)
	sun.light_energy = .8
	add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 28
	camera.position = Vector3(0,30,26)
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	add_child(map_geometry)
	add_child(signals)
	add_child(attack_layer)
	add_child(mechanic_geometry)
	build_ui()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--disguise-fixture="):
			fixture_mode = true
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--disguise-fixture="))))
	if not fixture_mode:
		fetch_config()

func build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var ui := Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme_resource := Theme.new()
	theme_resource.default_font = FONT
	preload("res://pixel_ui.gd").apply(theme_resource)
	ui.theme = theme_resource
	layer.add_child(ui)
	status = text_label("CROWD MASK · 서버 연결 중",26)
	status.position = Vector2(24,22)
	ui.add_child(status)
	ranking = text_label("",20)
	ranking.position = Vector2(24,60)
	ui.add_child(ranking)
	lobby = PanelContainer.new()
	ui.add_child(lobby)
	var layout := VBoxContainer.new()
	lobby.add_child(layout)
	layout.add_child(text_label("CROWD MASK · NPC 위장 생존",30))
	layout.add_child(text_label("임무 없이 NPC 흉내 · 마지막 생존자가 승리\n폰에서 내 위치 확인 / NPC 흉내 / 부채꼴 공격",20))
	map_picker = OptionButton.new()
	for title in ["막차 플랫폼 · 통근객","다섯 개의 방 · 관람객","컨베이어 창고 · 작업자"]:
		map_picker.add_item(title)
	map_picker.item_selected.connect(func(index):send_admin({"type":"disguise-map","map":["station","gallery","warehouse"][index]}))
	layout.add_child(map_picker)
	layout.add_child(text_label("오인 공격: 6초 공격 제한 + 1초 노출\n45초 무킬: NPC 정지 / 75초 무킬: 위치 공개",18))
	qr = TextureRect.new()
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	qr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	qr.custom_minimum_size = Vector2(200,200)
	layout.add_child(qr)
	join_label = text_label("QR 참가 주소 연결 중",16)
	layout.add_child(join_label)
	var scroll := ScrollContainer.new()
	layout.add_child(scroll)
	roster = VBoxContainer.new()
	scroll.add_child(roster)
	start_button = Button.new()
	start_button.text = "▶ 위장 생존 시작 · 2명 이상"
	start_button.disabled = true
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
	preload("res://lobby_ui.gd").setup(ui,lobby,qr,join_label,start_button,roster)
	var cover_layer := CanvasLayer.new()
	cover_layer.layer = 50
	add_child(cover_layer)
	curtain = ColorRect.new()
	curtain.color = Color("#11191d")
	curtain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	curtain.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	curtain.hide()
	cover_layer.add_child(curtain)

func floor_label(text: String, x: float, z: float) -> void:
	var marker := Label3D.new()
	marker.font = FONT
	marker.text = text
	marker.font_size = 28
	marker.pixel_size = .018
	marker.modulate = Color("#263f48")
	marker.outline_size = 0
	marker.position = Vector3(x,.15,z)
	marker.rotation_degrees.x = -55
	map_geometry.add_child(marker)

func build_map(map: Dictionary) -> void:
	for child in map_geometry.get_children():
		child.queue_free()
	for actor in actors.values():
		actor.queue_free()
	actors.clear()
	mechanic_signature = ""
	block(map_geometry,Vector3(35,.2,23),Vector3(0,-.15,0),Color("#243b44"))
	for room in map.rooms:
		block(map_geometry,Vector3(room.w,.12,room.d),Vector3(room.x,-.02,room.z),Color(room.color))
		floor_label(room.name,room.x,room.z-room.d/2+.8)
	var objects: Array = map.walls+map.props
	for prop in objects:
		block(map_geometry,Vector3(prop.w,prop.h,prop.d),Vector3(prop.x,prop.h/2,prop.z),Color(prop.color))
		if prop.kind == "wall":
			block(map_geometry,Vector3(prop.w+.04,.08,prop.d+.04),Vector3(prop.x,prop.h+.04,prop.z),Color("#a4b5ad"))
		elif map.id == "gallery":
			block(map_geometry,Vector3(prop.w*.65,.65,.07),Vector3(prop.x,prop.h*.6,prop.z+prop.d/2+.04),Color("#f0d392"))
		elif map.id == "warehouse":
			for y in [.45,1.1]:
				block(map_geometry,Vector3(prop.w*.75,.3,prop.d*.85),Vector3(prop.x,y,prop.z),Color("#b79567"))
			if str(prop.kind).begins_with("랙"):
				for i in range(-1,2):
					block(map_geometry,Vector3(prop.w*.7,.42,1.35),Vector3(prop.x,prop.h+.21,prop.z+i*prop.d*.26),Color("#b79567"))
					block(map_geometry,Vector3(.1,.44,1.37),Vector3(prop.x,prop.h+.21,prop.z+i*prop.d*.26),Color("#e5d0a1"))
	if map.id == "station":
		for z in [-.8,.8]:
			block(map_geometry,Vector3(34,.06,.12),Vector3(0,.05,z),Color("#9bb5c1"))
		for x in [-11,11]:
			block(map_geometry,Vector3(3.5,.08,4.3),Vector3(x,.08,0),Color("#d8bc6b"))
			for i in range(6):
				block(map_geometry,Vector3(3.3,.015,.22),Vector3(x,.13,-1.7+i*.65),Color("#fff1ae"))
		for z in [-2.5,2.5]:
			block(map_geometry,Vector3(34,.02,.13),Vector3(0,.08,z),Color("#efcb64"))
	elif map.id == "warehouse":
		for z in range(-9,10,2):
			block(map_geometry,Vector3(2.8,.025,.09),Vector3(0,.08,z),Color("#d5b15c"))
	for z in [-11.2,11.2]:
		block(map_geometry,Vector3(35,.25,.2),Vector3(0,.15,z),Color("#3e555f"))
	for x in [-17.2,17.2]:
		block(map_geometry,Vector3(.2,.25,23),Vector3(x,.15,0),Color("#3e555f"))

func update_mechanic(s: Dictionary) -> void:
	var k: Dictionary = s.mechanic
	var signature := str(s.map.id)+str(k.get("closed",false))+str(k.get("side",""))+str(k.get("direction",0))
	if signature != mechanic_signature:
		mechanic_signature = signature
		for child in mechanic_geometry.get_children():
			child.queue_free()
		train_node = null
		for prop in s.solids:
			if prop.kind in ["전시문","차단 선로"]:
				block(mechanic_geometry,Vector3(prop.w,prop.h,prop.d),Vector3(prop.x,prop.h/2+.04,prop.z),Color(prop.color))
		if k.kind == "belt":
			for z in range(-9,10,3):
				var surface := SurfaceTool.new()
				surface.begin(Mesh.PRIMITIVE_TRIANGLES)
				for point in [Vector3(0,.13,z+.5*k.direction),Vector3(-.36,.13,z-.25*k.direction),Vector3(.36,.13,z-.25*k.direction)]:
					surface.add_vertex(point)
				var arrow := MeshInstance3D.new()
				arrow.mesh = surface.commit()
				var material := StandardMaterial3D.new()
				material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
				material.cull_mode = BaseMaterial3D.CULL_DISABLED
				material.albedo_color = Color("#f6cc72")
				arrow.material_override = material
				mechanic_geometry.add_child(arrow)
		if k.kind == "train" and k.closed:
			train_node = Node3D.new()
			mechanic_geometry.add_child(train_node)
			block(train_node,Vector3(11,1.5,2),Vector3(0,.85,0),Color("#d8e4dd"))
			block(train_node,Vector3(11,.18,2.05),Vector3(0,.55,0),Color("#438787"))
			for x in range(-4,5,2):
				block(train_node,Vector3(1.2,.55,2.04),Vector3(x,1.15,0),Color("#527384"))
	if is_instance_valid(train_node):
		train_node.position.x = -24+48*float(k.progress)

func show_sector(points: Array, color: Color) -> void:
	if points.size() < 3:
		return
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(1,points.size()-1):
		for point in [points[0],points[i],points[i+1]]:
			surface.add_vertex(Vector3(point.x,.09,point.z))
	var mesh := MeshInstance3D.new()
	mesh.mesh = surface.commit()
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.albedo_color = color
	mesh.material_override = material
	attack_layer.add_child(mesh)
	var outline := SurfaceTool.new()
	outline.begin(Mesh.PRIMITIVE_LINE_STRIP)
	for point in points+[points[0]]:
		outline.add_vertex(Vector3(point.x,.12,point.z))
	var edge := MeshInstance3D.new()
	edge.mesh = outline.commit()
	var ink := StandardMaterial3D.new()
	ink.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ink.albedo_color = Color(color.r,color.g,color.b,1)
	edge.material_override = ink
	attack_layer.add_child(edge)

func make_person(map: Dictionary) -> Node3D:
	var actor := Node3D.new()
	block(actor,Vector3(.55,.65,.33),Vector3(0,.85,0),Color(map.coat))
	block(actor,Vector3(.38,.38,.36),Vector3(0,1.38,0),Color("#e5bf97"))
	block(actor,Vector3(.4,.12,.38),Vector3(0,1.61,0),Color("#ffe18a" if map.id == "warehouse" else "#303d49"))
	for x in [-.09,.09]:
		block(actor,Vector3(.08,.05,.035),Vector3(x,1.4,.19),Color("#253440"))
	for x in [-.15,.15]:
		var leg := block(actor,Vector3(.16,.5,.2),Vector3(x,.25,0),Color("#34434b"))
		leg.name = "LegL" if x < 0 else "LegR"
	for x in [-.38,.38]:
		var arm := block(actor,Vector3(.15,.52,.18),Vector3(x,.85,0),Color(map.coat))
		arm.name = "ArmL" if x < 0 else "ArmR"
	if map.id == "warehouse":
		block(actor,Vector3(.5,.3,.4),Vector3(0,.78,.4),Color("#b79567"))
	add_child(actor)
	return actor

func show_signal(x: float,z: float) -> void:
	var ring := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = .55
	mesh.outer_radius = .7
	mesh.rings = 12
	mesh.ring_segments = 12
	ring.mesh = mesh
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color("#ffba58")
	material.no_depth_test = true
	ring.material_override = material
	ring.position = Vector3(x,.05,z)
	signals.add_child(ring)

func accept_state(message: Dictionary) -> void:
	if message.get("game") != "disguise":
		return
	state = message
	var s: Dictionary = message.disguise
	var map: Dictionary = s.map
	if map_id != map.id:
		map_id = map.id
		build_map(map)
	curtain.visible = float(s.curtain) > 0
	update_mechanic(s)
	for child in attack_layer.get_children():
		child.queue_free()
	for swing in s.swings:
		if swing.age < .72 and swing.result != "cancelled":
			show_sector(swing.polygon,Color(1,.48,.36,.28) if swing.resolved else Color(1,.87,.51,.20))
			if swing.has("hit"):
				show_signal(swing.hit.x,swing.hit.z)
	for child in signals.get_children():
		child.queue_free()
	var people: Array = s.npcs.duplicate()
	var alive := 0
	var connected := 0
	for p in message.players:
		if p.connected:
			connected += 1
		if p.alive and p.participating:
			alive += 1
		if (message.phase == "lobby" and p.connected) or (p.alive and p.participating):
			people.append(p)
	var present := {}
	for p in people:
		present[p.id] = true
		if not actors.has(p.id):
			actors[p.id] = make_person(map)
		var actor: Node3D = actors[p.id]
		actor.position = Vector3(p.x,0,p.z)
		actor.rotation.y = float(p.get("yaw",0))
		actor.set_meta("moving",p.get("moving",false))
		actor.set_meta("swing_age",-1.0)
		for swing in s.swings:
			if swing.attacker == p.id and swing.age < .52:
				actor.set_meta("swing_age",float(swing.age))
		if float(p.get("exposed",0)) > 0:
			show_signal(p.x,p.z)
	for id in actors.keys():
		if not present.has(id):
			actors[id].queue_free()
			actors.erase(id)
	for point in s.revealPoints:
		show_signal(point.x,point.z)
	status.text = "CROWD MASK · %s · 생존 %d명" % [map.name,alive]
	ranking.text = str(s.map.concept)
	if s.stage == "freeze":
		ranking.text = map.event+" · NPC 순간 정지"
	elif s.stage == "reveal":
		ranking.text = "생존자 위치 공개!"
	elif message.phase == "running":
		ranking.text = str(s.mechanic.label)+" · 무킬 %d초" % s.quiet
	elif message.phase == "finished":
		var names := PackedStringArray()
		for p in message.results.players:
			if message.results.winnerIds.has(p.id):
				names.append(p.name)
		ranking.text = "최후의 생존자: "+", ".join(names) if not names.is_empty() else "생존자 없음 · 무승부"
	start_button.disabled = not authenticated or message.phase != "lobby" or connected < 2
	return_button.disabled = not authenticated or message.phase == "lobby"
	map_picker.disabled = message.phase != "lobby"
	map_picker.select(["station","gallery","warehouse"].find(map.id))
	preload("res://lobby_ui.gd").sync(lobby,message.phase)
	for child in roster.get_children():
		child.queue_free()
	for p in message.players:
		roster.add_child(text_label(p.name+(" · 연결됨" if p.connected else " · 연결 끊김"),18))
	var connection := JSON.stringify(message.get("connection",{}))
	if connection != connection_signature and not fixture_mode:
		connection_signature = connection
		fetch_config()

func _process(delta: float) -> void:
	elapsed += delta
	for actor in actors.values():
		var walk: float = sin(elapsed*9)*.4 if actor.get_meta("moving",false) else 0
		actor.get_node("LegL").rotation.x = walk
		actor.get_node("LegR").rotation.x = -walk
		var age: float = actor.get_meta("swing_age",-1.0)
		var punch: float = sin(clampf(age/.52,0,1)*PI) if age >= 0 else 0.0
		actor.get_node("ArmR").rotation.x = -punch*2.3
		actor.get_node("ArmR").rotation.z = -punch*.65
		actor.get_node("ArmL").rotation.x = -punch*.5
		actor.scale.z = 1+punch*.15
		if age >= 0:
			actor.set_meta("swing_age",age+delta)
	if fixture_mode:
		capture_frames += 1
		if capture_frames == 12:
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("res://../.runtime/disguise-"+map_id+".png")
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
				send_admin({"type":"game","game":"disguise"})
			elif message.type == "state" and authenticated:
				accept_state(message)
			elif message.type == "error":
				status.text = message.message
