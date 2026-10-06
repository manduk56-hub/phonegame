extends Node3D

const FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")
var circuit: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://circuit.json"))
var circuits: Array = JSON.parse_string(FileAccess.get_file_as_string("res://circuits.json"))
var circuit_world: Node3D
var track_choice: OptionButton
var track_info: Label
var track_preview: Control
var car_shapes: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://car-shapes.json"))
var socket := WebSocketPeer.new()
var state: Dictionary = {}
var cars: Dictionary = {}
var broadcast: Control
var camera: Camera3D
var status: Label
var ranking: Label
var score_panel: PanelContainer
var roster: Label
var join_label: Label
var qr: TextureRect
var lobby: PanelContainer
var start_button: Button
var return_button: Button
var time_input: SpinBox
var server_url := "http://127.0.0.1:3000"
var admin_key := ""
var authenticated := false
var elapsed := 0.0
var last_connect := -5.0
var last_config := -5.0
var config_pending := false
var connection_signature := ""
var network_updates := 0
var captured := false

func block(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	node.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.85
	node.material_override = mat
	node.position = pos
	parent.add_child(node)
	return node

func text_label(text: String, font_size := 22) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size",font_size)
	return label

func triangle(tool: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	# Godot's front faces use clockwise winding; Three uses counterclockwise.
	var normal := (b-a).cross(c-a).normalized()
	for vertex in [a,c,b]:
		tool.set_normal(normal)
		tool.add_vertex(vertex)

func _ready() -> void:
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=")
	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#b4cccd")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#dbe8dc")
	environment.ambient_light_energy = 0.45
	env.environment = environment
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55,-35,0)
	sun.light_energy = 0.65
	sun.shadow_enabled = true
	add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 100
	camera.position = Vector3(0,105,48)
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	build_circuit()
	build_ui()
	fetch_config()

func build_circuit() -> void:
	if is_instance_valid(circuit_world):
		remove_child(circuit_world)
		circuit_world.queue_free()
	var world := Node3D.new()
	circuit_world = world
	add_child(world)
	for track in circuits:
		if track.id != circuit.id:
			continue
		for prop in track.scenery:
			var mesh := block(world,Vector3(prop.size[0],prop.size[1],prop.size[2]),Vector3(prop.pos[0],prop.pos[1],prop.pos[2]),Color(prop.color))
			mesh.rotation.y = float(prop.yaw)
	var points: Array = circuit.points
	var edges: Array = []
	for i in range(points.size()):
		var prev: Dictionary = points[(i+points.size()-1)%points.size()]
		var next: Dictionary = points[(i+1)%points.size()]
		var tangent := Vector2(float(next.x)-float(prev.x),float(next.z)-float(prev.z)).normalized()
		var p: Dictionary = points[i]
		var normal := Vector3(tangent.y,0,-tangent.x)*float(circuit.width)/2
		var center := Vector3(float(p.x),.075,float(p.z))
		edges.append([center+normal,center-normal])
	var road_tool := SurfaceTool.new()
	road_tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(edges.size()):
		var next: int = (i+1)%edges.size()
		triangle(road_tool,edges[i][0],edges[i][1],edges[next][0])
		triangle(road_tool,edges[i][1],edges[next][1],edges[next][0])
	road_tool.index()
	var asphalt := MeshInstance3D.new()
	asphalt.mesh = road_tool.commit()
	var road_material := StandardMaterial3D.new()
	road_material.albedo_color = Color("#404a50")
	asphalt.material_override = road_material
	world.add_child(asphalt)
	for i in range(points.size()):
		var a: Dictionary = points[i]
		var b: Dictionary = points[(i+1)%points.size()]
		var delta := Vector2(float(b.x)-float(a.x),float(b.z)-float(a.z))
		var yaw := atan2(delta.x,delta.y)
		var mid := Vector3((float(a.x)+float(b.x))/2,.02,(float(a.z)+float(b.z))/2)
		for side in [-1,1]:
			var normal: Vector3 = Vector3(cos(yaw),0,-sin(yaw))*side
			var curb := block(world,Vector3(.9,.18,delta.length()+.12),mid+normal*(float(circuit.width)/2+.45)+Vector3(0,.11,0),Color("#e7ddd0") if i%6 < 3 else Color("#cf6757"))
			curb.rotation.y = yaw
			var rail := block(world,Vector3(.25,.6,delta.length()+.15),mid+normal*(float(circuit.width)/2+2.05)+Vector3(0,.38,0),Color("#b6beb5"))
			rail.rotation.y = yaw
			var edge := block(world,Vector3(.16,.02,delta.length()+.15),mid+normal*(float(circuit.width)/2-.2)+Vector3(0,.06,0),Color("#e5e8df"))
			edge.rotation.y = yaw
			if i%4 == 0:
				block(world,Vector3(.14,2.1,.14),mid+normal*(float(circuit.width)/2+2.05)+Vector3(0,1.08,0),Color("#7c918f"))
	var start: Dictionary = points[0]
	var next: Dictionary = points[1]
	var start_yaw := atan2(float(next.x)-float(start.x),float(next.z)-float(start.z))
	var origin := Vector3(float(start.x),0,float(start.z))
	for i in range(12):
		for j in range(2):
			var flag := block(world,Vector3(1,.02,.8),origin+Vector3(i-5.5,.09,(j-.5)*.8).rotated(Vector3.UP,start_yaw),Color("#f6edda") if (i+j)%2 else Color("#1d262c"))
			flag.rotation.y = start_yaw
	for side in [-1,1]:
		block(world,Vector3(.4,5,.4),origin+Vector3(side*7,2.5,0).rotated(Vector3.UP,start_yaw),Color("#334147"))
	var gantry := block(world,Vector3(14,.65,.5),origin+Vector3(0,5,0),Color("#efc369"))
	gantry.rotation.y = start_yaw
	for i in range(5):
		var light := block(world,Vector3(.48,.48,.55),origin+Vector3((i-2)*.8,4.5,0).rotated(Vector3.UP,start_yaw),Color("#da4b41"))
		light.rotation.y = start_yaw
	merge_parts(world)

func merge_parts(parent: Node3D, brick := false) -> void:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for child in parent.get_children():
		if not child is MeshInstance3D:
			continue
		var arrays: Array = child.mesh.surface_get_arrays(0)
		for index in arrays[Mesh.ARRAY_INDEX]:
			# Vertex colors are linear in the Compatibility renderer.
			tool.set_color(child.material_override.albedo_color.srgb_to_linear())
			tool.set_normal((child.transform.basis*arrays[Mesh.ARRAY_NORMAL][index]).normalized())
			tool.add_vertex(child.transform*arrays[Mesh.ARRAY_VERTEX][index])
		child.queue_free()
	var combined := MeshInstance3D.new()
	tool.index()
	combined.mesh = tool.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = false
	mat.roughness = .85
	combined.material_override = mat
	if brick:
		var brick_material := ShaderMaterial.new()
		brick_material.shader = load("res://voxel.gdshader")
		brick_material.set_shader_parameter("cell_contrast",0.06)
		combined.material_override = brick_material
	parent.add_child(combined)

func build_car_geometry(root: Node3D, shape: Dictionary, paint: Color) -> void:
	for part in shape.parts:
		var c: Color = paint if part.color == "paint" else Color(part.color)
		var node := block(root,Vector3(part.size[0],part.size[1],part.size[2]),Vector3(part.pos[0],part.pos[1],part.pos[2]),c)
		node.rotation = Vector3(part.rot[0],part.rot[1],part.rot[2])
	for part in shape.cylinders:
		var node := MeshInstance3D.new()
		var mesh := CylinderMesh.new()
		mesh.top_radius = part.radius
		mesh.bottom_radius = part.radius
		mesh.height = part.height
		mesh.radial_segments = part.segments
		node.mesh = mesh
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(part.color)
		node.material_override = mat
		node.position = Vector3(part.pos[0],part.pos[1],part.pos[2])
		if part.axis == "x": node.rotation.z = PI/2
		elif part.axis == "z": node.rotation.x = PI/2+float(part.get("tilt",0))
		root.add_child(node)
	for part in shape.panels:
		var tool := SurfaceTool.new()
		tool.begin(Mesh.PRIMITIVE_TRIANGLES)
		var points: Array = part.points
		var a := Vector3(points[0][0],points[0][1],points[0][2])
		for i in range(1,points.size()-1):
			var b := Vector3(points[i][0],points[i][1],points[i][2])
			var c := Vector3(points[i+1][0],points[i+1][1],points[i+1][2])
			if part.has("normals"):
				for entry in [[0,1],[i+1,1],[i,1],[0,-1],[i,-1],[i+1,-1]]:
					var n: Array = part.normals[entry[0]]
					var v: Array = points[entry[0]]
					tool.set_normal(Vector3(n[0],n[1],n[2])*entry[1])
					tool.add_vertex(Vector3(v[0],v[1],v[2]))
			else:
				triangle(tool,a,b,c)
				triangle(tool,a,c,b)
		tool.index()
		var node := MeshInstance3D.new()
		node.mesh = tool.commit()
		var mat := StandardMaterial3D.new()
		mat.albedo_color = paint if part.color == "paint" else Color(part.color)
		var shade := float(part.get("shade",1.0))
		mat.albedo_color = Color(minf(1,mat.albedo_color.r*shade),minf(1,mat.albedo_color.g*shade),minf(1,mat.albedo_color.b*shade),1)
		node.material_override = mat
		root.add_child(node)

func make_car(p: Dictionary, index: int) -> Dictionary:
	var root := Node3D.new()
	add_child(root)
	var kind := str(p.car)
	var paint := Color(p.color)
	var shape: Dictionary = car_shapes[kind]
	build_car_geometry(root,shape,paint)
	merge_parts(root,shape.get("style","") == "brick")
	root.scale = Vector3.ONE
	var marker := Label3D.new()
	marker.text = str(index+1)
	marker.font = FONT
	marker.font_size = 56
	marker.pixel_size = .045
	marker.modulate = paint
	marker.position.y = 2.8
	marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	marker.no_depth_test = true
	marker.visible = false
	root.add_child(marker)
	root.position = Vector3(p.x,0,p.z)
	root.rotation.y = p.yaw
	return {"root":root,"signature":str(p.car)+str(p.color),"marker":marker}

func build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var ui := Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme := Theme.new()
	theme.default_font = FONT
	theme.default_font_size = 22
	ui.theme = theme
	layer.add_child(ui)
	broadcast = Control.new()
	broadcast.set_script(preload("res://race_broadcast.gd"))
	broadcast.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	broadcast.offset_top = 65
	broadcast.offset_bottom = -85
	broadcast.offset_left = 16
	broadcast.offset_right = -16
	ui.add_child(broadcast)
	broadcast.setup(self)
	broadcast.hide()
	status = text_label("POCKET RACING · 연결 중",28)
	status.position = Vector2(24,22)
	ui.add_child(status)
	score_panel = PanelContainer.new()
	score_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	score_panel.offset_left = -280
	score_panel.offset_right = -20
	score_panel.offset_top = 70
	ui.add_child(score_panel)
	ranking = text_label("%d바퀴 · 차량 충돌 사용" % int(circuit.laps),18)
	score_panel.add_child(ranking)
	lobby = PanelContainer.new()
	lobby.position = Vector2(55,150)
	lobby.custom_minimum_size = Vector2(440,600)
	ui.add_child(lobby)
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation",8)
	lobby.add_child(layout)
	layout.add_child(text_label("서킷 선택 / 대기실",28))
	track_choice = OptionButton.new()
	for track in circuits:
		track_choice.add_item("%s · %.2f km · %s" % [track.name,float(track.length)/1000.0,track.difficulty])
	track_choice.item_selected.connect(func(index):send_admin({"type":"track","track":circuits[index].id}))
	layout.add_child(track_choice)
	track_preview = Control.new()
	track_preview.set_script(preload("res://track_map.gd"))
	track_preview.custom_minimum_size = Vector2(400,100)
	layout.add_child(track_preview)
	track_info = text_label("",16)
	track_info.custom_minimum_size.x = 400
	track_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layout.add_child(track_info)
	layout.add_child(text_label("QR로 참가 → 폰에서 차 선택 → 출발",18))
	qr = TextureRect.new()
	qr.custom_minimum_size = Vector2(145,145)
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	qr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	layout.add_child(qr)
	join_label = text_label("폰 접속 주소를 확인하는 중",16)
	join_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layout.add_child(join_label)
	roster = text_label("참가자를 기다리는 중",18)
	roster.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layout.add_child(roster)
	var row := HBoxContainer.new()
	layout.add_child(row)
	row.add_child(text_label("최대 경기 시간(초)",18))
	time_input = SpinBox.new()
	time_input.min_value = 60
	time_input.max_value = 900
	time_input.value = 300
	row.add_child(time_input)
	start_button = Button.new()
	start_button.text = "▶ %d바퀴 레이스 시작" % int(circuit.laps)
	start_button.pressed.connect(func():
		time_input.apply()
		send_admin({"type":"configure","teams":1,"duration":time_input.value})
		send_admin({"type":"start"})
	)
	layout.add_child(start_button)
	return_button = Button.new()
	return_button.text = "대기실로 돌아가기"
	return_button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	return_button.offset_left = -280
	return_button.offset_top = -65
	return_button.offset_right = -20
	return_button.offset_bottom = -20
	return_button.pressed.connect(func():send_admin({"type":"lobby"}))
	ui.add_child(return_button)
	start_button.disabled = true
	return_button.disabled = true

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

func accept_state(message: Dictionary) -> void:
	state = message
	if message.game != "racing":
		return
	if circuit.get("id","") != message.circuit.id:
		circuit = message.circuit
		build_circuit()
		for car in cars.values():
			car.root.queue_free()
		cars.clear()
	for index in range(circuits.size()):
		if circuits[index].id == message.circuit.id:
			track_choice.select(index)
	track_choice.disabled = not authenticated or message.phase != "lobby"
	track_preview.set_track(circuit)
	track_info.text = str(circuit.description)
	var signature := JSON.stringify(message.get("connection",{}))
	if signature != connection_signature:
		connection_signature = signature
		fetch_config()
	var present := {}
	for index in range(state.players.size()):
		var p: Dictionary = state.players[index]
		present[p.id] = true
		if cars.has(p.id) and cars[p.id].signature != str(p.car)+str(p.color):
			cars[p.id].root.queue_free()
			cars.erase(p.id)
		if not cars.has(p.id):
			cars[p.id] = make_car(p,index)
		for mesh in cars[p.id].root.get_children():
			if mesh is MeshInstance3D: mesh.layers = 1 << (index+1)
	for id in cars.keys():
		if not present.has(id):
			cars[id].root.queue_free()
			cars.erase(id)
	broadcast.update_state(state)
	lobby.visible = state.phase == "lobby"
	score_panel.visible = state.phase == "finished"
	var connected: Array = state.players.filter(func(p):return p.connected)
	start_button.disabled = not authenticated or connected.is_empty() or state.phase != "lobby"
	return_button.disabled = not authenticated or state.phase == "lobby"
	roster.text = "접속 %d / 16명\n" % connected.size()
	for p in state.players:
		roster.text += "%s%s  " % [p.name," (오프라인)" if not p.connected else ""]
	var laps := int(state.race.laps)
	start_button.text = "▶ %d바퀴 레이스 시작" % laps
	status.text = "POCKET RACING / %s" % ("대기실 · %d바퀴" % laps if state.phase == "lobby" else ("체커기! 경기 종료" if state.phase == "finished" else ("출발 %d" % ceili(state.race.countdown) if state.race.countdown > 0 else "%d초 · %d바퀴" % [ceili(state.remaining),laps])))
	var players: Array = state.players.duplicate()
	players.sort_custom(func(a,b):return a.rank < b.rank)
	ranking.text = "%s\n%.2f km · %d바퀴\n\n" % [circuit.name,float(circuit.length)/1000.0,laps]
	for p in players:
		ranking.text += "%02d · %s · %d/%d%s\n" % [int(p.rank),p.name,mini(laps,int(p.lap)+1),laps," ✓" if p.finishedAt != null else ""]
	if state.phase == "finished":
		ranking.text = "최종 순위 / 체커기\n\n"
		for p in state.results.players:
			ranking.text += "%d위 · %s · %s\n" % [int(p.rank),p.name,"%.2f초" % float(p.time) if p.time != null else "%d바퀴" % int(p.lap)]

func _process(delta: float) -> void:
	elapsed += delta
	socket.poll()
	if socket.get_ready_state() == WebSocketPeer.STATE_CLOSED and elapsed-last_connect > 2:
		last_connect = elapsed
		authenticated = false
		admin_key = ""
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
				send_admin({"type":"game","game":"racing"})
			elif message.type == "state" and authenticated:
				network_updates += 1
				accept_state(message)
			elif message.type == "error":
				status.text = str(message.message)
	elif elapsed-last_config > 3:
		fetch_config()
	if state.get("game") == "racing":
		for p in state.players:
			if not cars.has(p.id):
				continue
			var car: Dictionary = cars[p.id]
			car.root.position = car.root.position.lerp(Vector3(p.x,0,p.z),minf(1,delta*16))
			car.root.rotation.y = lerp_angle(car.root.rotation.y,p.yaw,minf(1,delta*16))
	var viewport_size := get_viewport().get_visible_rect().size
	var bounds: Dictionary = circuit.bounds
	var center := Vector3((float(bounds.minX)+float(bounds.maxX))/2,0,(float(bounds.minZ)+float(bounds.maxZ))/2)
	var in_lobby: bool = state.get("phase","lobby") == "lobby"
	var reserved_width := 720.0 if in_lobby else 290.0
	var available_aspect := maxf(.7,(viewport_size.x-reserved_width)/viewport_size.y)
	camera.size = maxf((float(bounds.maxZ)-float(bounds.minZ))*.97+12,(float(bounds.maxX)-float(bounds.minX))/available_aspect)
	camera.position = center+Vector3(60,600,225)
	camera.look_at(center)
	camera.h_offset = camera.size*(-.14 if in_lobby else .08)
	if "--race-capture" in OS.get_cmdline_user_args() and elapsed>4 and not captured:
		captured = true
		capture.call_deferred()

func capture() -> void:
	await RenderingServer.frame_post_draw
	var directory := OS.get_environment("PLAYROOM_CAPTURE_DIR")
	if directory.is_empty():
		directory = "res://../.runtime"
	get_viewport().get_texture().get_image().save_png(directory.path_join("racing-pc.png"))
	var file := FileAccess.open(directory.path_join("racing-render.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"game":state.get("game"),"players":cars.size(),"updates":network_updates,"qr":qr.texture != null,"track":circuit.id,"fps":Performance.get_monitor(Performance.TIME_FPS)}))
	get_tree().quit()
