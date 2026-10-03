extends Node3D

const COLORS = ["#faad28", "#52c8fa", "#f078a6", "#77d99b", "#a99aff", "#fb775b", "#e0d16c", "#69d3cb"]
const GAME_FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")
var arena: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://arena.json"))
var socket := WebSocketPeer.new()
var machines: Dictionary = {}
var team_nodes: Array = []
var ground_piles: Dictionary = {}
var team_count := 0
var state: Dictionary = {}
var status: Label
var scores: RichTextLabel
var attendance: Label
var hint: Label
var chat_log: RichTextLabel
var chat_messages: Array = []
var join_label: Label
var qr: TextureRect
var center_pile: Node3D
var last_connect := -5.0
var elapsed := 0.0
var capture_done := false
var preview_mode := false
var machine_material := ShaderMaterial.new()
var server_url := "http://127.0.0.1:3000"
var network_updates := 0
var capture_name := "preview.png"
var connection_key := ""
var admin_key := ""
var host_token := ""
var authenticated := false
var config_pending := false
var last_config := -5.0
var lobby_panel: PanelContainer
var lobby_title: Label
var lobby_message: Label
var team_select: OptionButton
var duration_input: SpinBox
var network_select: OptionButton
var connection_help: Label
var configure_button: Button
var start_button: Button
var return_button: Button
var player_list: VBoxContainer
var player_signature := ""
var settings_signature := ""
var previous_phase := ""
var reset_dialog: ConfirmationDialog
var result_panel: PanelContainer
var result_title: Label
var result_body: RichTextLabel
var result_return: Button
var result_signature := ""
var camera: Camera3D
var arena_visuals: Array[Node3D] = []
var ceremony_stage: Node3D
var ceremony_steps: Array[MeshInstance3D] = []
var chat_panel: PanelContainer
var match_environment: Environment
var result_backdrop: Node3D
var player_controls: Array[Control] = []

func box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	node.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.88
	node.material_override = mat
	node.position = pos
	parent.add_child(node)
	return node

func label3(parent: Node3D, text: String, pos: Vector3, color: Color, font_size := 54) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.font = GAME_FONT
	label.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	label.outline_size = 8
	label.outline_modulate = Color("#10171c")
	label.position = pos
	label.font_size = font_size
	label.pixel_size = 0.014
	label.modulate = color
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	parent.add_child(label)
	return label

func axle(parent: Node3D, radius: float, width: float, pos: Vector3, color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = width
	mesh.radial_segments = 8
	node.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.8
	node.material_override = mat
	node.position = pos
	node.rotation.z = PI/2
	parent.add_child(node)
	return node

func ram(parent: Node3D) -> Dictionary:
	var root := Node3D.new()
	parent.add_child(root)
	var sleeve := box(root,Vector3(0.13,0.13,1),Vector3.ZERO,Color("#303740"))
	var rod := box(root,Vector3(0.065,0.065,1),Vector3.ZERO,Color("#cbd3d8"))
	sleeve.set_meta("dynamic_mesh",true)
	rod.set_meta("dynamic_mesh",true)
	return {"root":root,"sleeve":sleeve,"rod":rod}

func merge_static_parts(parent: Node3D, paint_material: Material = null) -> void:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 0
	for child in parent.get_children():
		if child is MeshInstance3D and not child.has_meta("dynamic_mesh"):
			var arrays: Array = child.mesh.surface_get_arrays(0)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			var color: Color = child.material_override.albedo_color
			for index in indices:
				tool.set_color(color)
				tool.set_normal((child.transform.basis*normals[index]).normalized())
				tool.add_vertex(child.transform*vertices[index])
			count += indices.size()
			child.visible = false
			child.queue_free()
		elif child is Node3D and not child is MeshInstance3D:
			merge_static_parts(child,paint_material)
	if count > 0:
		var combined := MeshInstance3D.new()
		tool.index()
		combined.mesh = tool.commit()
		combined.material_override = paint_material if paint_material != null else machine_material
		parent.add_child(combined)

func update_ram(part: Dictionary, from: Vector3, to: Vector3) -> void:
	var length := from.distance_to(to)
	var root: Node3D = part.root
	root.position = from
	root.look_at(root.get_parent().to_global(to),Vector3.UP,true)
	part.sleeve.scale.z = length*0.62
	part.sleeve.position.z = length*0.31
	part.rod.scale.z = length*0.45
	part.rod.position.z = length*0.775

func stepped_beam(parent: Node3D, length: float, width: float, height: float, arch: float, color: Color) -> void:
	var sections := 12
	for i in range(sections):
		var t := (float(i)+0.5)/sections
		var y := sin(t*PI)*arch
		var shade := color.lightened(0.04) if i%3 == 0 else color
		var taper := 1.0 - 0.18*sin(t*PI)
		box(parent,Vector3(width*taper,height*taper,length/sections+0.02),Vector3(0,y,t*length),shade)
		box(parent,Vector3(width*taper,0.045,length/sections+0.02),Vector3(0,y+height*taper/2,t*length),color.lightened(0.15))

func make_road(map_size: float) -> void:
	var road_length := map_size*5.0
	var surface := box(self,Vector3(map_size,0.5,road_length),Vector3(0,-0.3,0),Color("#34383d"))
	var asphalt := ShaderMaterial.new()
	asphalt.shader = load("res://asphalt.gdshader")
	surface.material_override = asphalt
	var markings := Node3D.new()
	add_child(markings)
	# Four lanes in each direction, bounded by two solid shoulder lines.
	var road_half := map_size/2.0-2.0
	var lane_width := road_half/4.0
	for side in [-1,1]:
		var lawn := box(self,Vector3(map_size*3.0,0.4,road_length),Vector3(side*(map_size/2.0+4.0+map_size*1.5),-0.25,0),Color("#4f793b"))
		var grass := ShaderMaterial.new()
		grass.shader = load("res://grass.gdshader")
		lawn.material_override = grass
		box(markings,Vector3(0.16,0.012,road_length),Vector3(side*0.22,-0.032,0),Color("#e8b83f"))
		box(markings,Vector3(0.18,0.012,road_length),Vector3(side*road_half,-0.032,0),Color("#e4e3d9"))
		for lane in range(1,4):
			var z := -road_length/2.0+2.0
			while z+1.5 < road_length/2.0:
				box(markings,Vector3(0.14,0.012,3.0),Vector3(side*lane*lane_width,-0.032,z),Color("#deded6"))
				z += 6.0
		# Raised concrete sidewalks and a pale curb run along the road.
		box(markings,Vector3(4.0,0.3,road_length),Vector3(side*(map_size/2.0+2.0),0.05,0),Color("#93958f"))
		box(markings,Vector3(0.3,0.36,road_length),Vector3(side*(map_size/2.0+0.15),0.08,0),Color("#c9cbc3"))
		box(markings,Vector3(0.025,0.012,road_length),Vector3(side*(map_size/2.0+2.15),0.206,0),Color("#70746f"))
		var seam_z := -road_length/2.0+3.0
		while seam_z < road_length/2.0:
			box(markings,Vector3(3.7,0.012,0.035),Vector3(side*(map_size/2.0+2.15),0.206,seam_z),Color("#70746f"))
			box(markings,Vector3(0.3,0.012,0.035),Vector3(side*(map_size/2.0+0.15),0.266,seam_z),Color("#93958f"))
			seam_z += 3.0
	merge_static_parts(markings)

func _ready() -> void:
	host_token = OS.get_environment("DIRT_RALLY_HOST_KEY")
	if not OS.get_environment("DIRT_RALLY_SERVER_URL").is_empty():
		server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/")
	var fixture_path := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--fixture="):
			fixture_path = arg.trim_prefix("--fixture=")
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=").trim_suffix("/")
		if arg.begins_with("--capture-name="):
			var name := arg.trim_prefix("--capture-name=")
			if not name.contains("/") and not name.contains("\\") and name.ends_with(".png"):
				capture_name = name
	preview_mode = "--preview" in OS.get_cmdline_user_args() or "--model-preview" in OS.get_cmdline_user_args() or not fixture_path.is_empty()
	machine_material.shader = load("res://voxel.gdshader")
	var env := WorldEnvironment.new()
	var environment := Environment.new()
	match_environment = environment
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#242822")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#c5d5df")
	environment.ambient_light_energy = 0.65
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#628fa4")
	sky_material.sky_horizon_color = Color("#c1ceca")
	sky_material.ground_horizon_color = Color("#c1ceca")
	sky_material.ground_bottom_color = Color("#59614c")
	sky_material.sky_curve = 0.25
	sky_material.sun_angle_max = 0.0
	var result_sky := Sky.new()
	result_sky.sky_material = sky_material
	environment.sky = result_sky
	env.environment = environment
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55,-30,0)
	sun.light_energy = 0.85
	sun.shadow_enabled = true
	add_child(sun)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = float(arena.cameraSize)
	camera.position = Vector3(34,40,42)
	add_child(camera)
	camera.look_at(Vector3.ZERO)
	var map_size := float(arena.size)
	make_road(map_size)
	center_pile = pile(4.3,Color("#c29652"))
	add_child(center_pile)
	label3(self,"중앙 모래더미",Vector3(0,4.5,0),Color("#ffe0ab"),64)
	for child in get_children():
		if child is Node3D and not child is Camera3D and not child is Light3D:
			arena_visuals.append(child)
	ceremony_stage = Node3D.new()
	add_child(ceremony_stage)
	for row in range(1,4):
		ceremony_steps.append(box(ceremony_stage,Vector3(25,row*2.4,5.8),Vector3(0,row*1.2,float(arena.driveLimit)-row*6),Color("#758064")))
	ceremony_stage.hide()
	result_backdrop = Node3D.new()
	add_child(result_backdrop)
	var backdrop_grass := box(result_backdrop,Vector3(4000,0.1,4000),Vector3(0,-0.13,0),Color("#4f793b"))
	var grass_material := ShaderMaterial.new()
	grass_material.shader = load("res://grass.gdshader")
	backdrop_grass.material_override = grass_material
	var backdrop_road := box(result_backdrop,Vector3(map_size,0.1,4000),Vector3(0,-0.115,0),Color("#34383d"))
	var road_material := ShaderMaterial.new()
	road_material.shader = load("res://asphalt.gdshader")
	backdrop_road.material_override = road_material
	result_backdrop.hide()
	make_ui()
	if preview_mode:
		if not fixture_path.is_empty():
			var fixture = JSON.parse_string(FileAccess.get_file_as_string(fixture_path))
			if fixture is Dictionary:
				accept_state(fixture)
		else:
			preview()
	else:
		fetch_config()
	if "--model-preview" in OS.get_cmdline_user_args():
		camera.size = 7.5
		camera.position = Vector3(5,4,7)
		camera.look_at(Vector3(0,1,0.6))
		center_pile.visible = false
		for item in team_nodes:
			item.root.visible = false
		for child in get_children():
			if child is Label3D or child is CanvasLayer:
				child.visible = false
		machines["0"].marker.visible = false

func pile(radius: float, color: Color) -> Node3D:
	var root := Node3D.new()
	for x in range(-4,5):
		for z in range(-4,5):
			var d := Vector2(x,z).length()
			if d > 4.4:
				continue
			var h := maxf(0.2,(4.6-d)*0.55)
			box(root,Vector3(radius/4.4,h,radius/4.4),Vector3(x*radius/4.4,h/2,z*radius/4.4),color.lightened(float((x*x+z*z)%3)*0.045))
	merge_static_parts(root)
	return root

func excavator(p: Dictionary, index: int) -> Dictionary:
	var root := Node3D.new()
	add_child(root)
	var yellow := Color("#edb323")
	# Vertex alpha marks painted panels; steel and windows keep their own colors.
	yellow.a = 0.5
	var paint_material := machine_material.duplicate() as ShaderMaterial
	paint_material.set_shader_parameter("team_color",Color(COLORS[int(p.team)]))
	var dark := Color("#303740")
	for side in [-1,1]:
		box(root,Vector3(0.48,0.48,2.1),Vector3(side*0.65,0.35,0),dark)
		for n in range(10):
			box(root,Vector3(0.55,0.09,0.1),Vector3(side*0.65,0.6,-0.96+n*0.21),Color("#59616a"))
			box(root,Vector3(0.55,0.09,0.1),Vector3(side*0.65,0.11,-0.96+n*0.21),Color("#434c54"))
		for n in range(5):
			axle(root,0.19,0.025,Vector3(side*0.905,0.35,-0.8+n*0.4),Color("#737982"))
			axle(root,0.085,0.03,Vector3(side*0.922,0.35,-0.8+n*0.4),dark)
			box(root,Vector3(0.035,0.065,0.2),Vector3(side*0.941,0.35,-0.8+n*0.4),Color("#969ca3"))
		box(root,Vector3(0.035,0.055,1.55),Vector3(side*0.95,0.52,0),Color("#626972"))
		box(root,Vector3(0.035,0.055,1.55),Vector3(side*0.95,0.18,0),Color("#464d57"))
		for end in [-1,1]:
			for n in range(5):
				var a := (float(n)/4-0.5)*PI
				var tread := box(root,Vector3(0.55,0.09,0.11),Vector3(side*0.65,0.35+sin(a)*0.27,end*(0.9+cos(a)*0.27)),Color("#434c54"))
				tread.rotation.x = -end*a
	box(root,Vector3(1.3,0.25,1.5),Vector3(0,0.68,0),dark)
	var upper := Node3D.new()
	upper.position.y = 1.45
	root.add_child(upper)
	box(upper,Vector3(1.5,0.6,1.4),Vector3(0,-0.25,-0.15),yellow)
	box(upper,Vector3(1.6,0.7,0.6),Vector3(0,-0.15,-0.8),yellow.darkened(0.1))
	box(upper,Vector3(1.5,0.12,0.5),Vector3(0,0.27,-0.79),yellow.lightened(0.1))
	box(upper,Vector3(1.42,0.12,0.58),Vector3(0,0.36,-0.76),yellow.lightened(0.18))
	box(upper,Vector3(1.28,0.08,0.5),Vector3(0,0.46,-0.76),yellow.lightened(0.24))
	box(upper,Vector3(0.46,0.1,0.4),Vector3(0.35,0.53,-0.76),dark)
	box(upper,Vector3(0.25,0.12,0.25),Vector3(0.35,0.64,-0.76),Color("#555b64"))
	for n in range(4):
		box(upper,Vector3(1.13,0.055,0.03),Vector3(0,0.14-n*0.13,-1.115),dark)
		for side in [-1,1]:
			box(upper,Vector3(0.035,0.045,0.36),Vector3(side*0.805,0.13-n*0.11,-0.8),dark)
	box(upper,Vector3(0.65,1.1,0.85),Vector3(-0.42,0.45,0.08),dark)
	box(upper,Vector3(0.58,0.7,0.03),Vector3(-0.42,0.55,0.52),Color("#86b0c4"))
	box(upper,Vector3(0.03,0.7,0.72),Vector3(-0.755,0.55,0.1),Color("#6996ad"))
	box(upper,Vector3(0.03,0.68,0.69),Vector3(-0.085,0.55,0.1),Color("#537d91"))
	box(upper,Vector3(0.53,0.6,0.03),Vector3(-0.42,0.53,-0.365),Color("#537d91"))
	for n in range(4):
		box(upper,Vector3(0.1,0.12,0.012),Vector3(-0.61+n*0.1,0.78-n*0.09,0.54),Color("#adc6db"))
		box(upper,Vector3(0.012,0.1,0.13),Vector3(-0.775,0.81-n*0.08,-0.14+n*0.13),Color("#8faccc"))
	for side in [-1,1]:
		box(upper,Vector3(0.04,0.78,0.04),Vector3(-0.42+side*0.26,0.55,0.55),dark)
	box(upper,Vector3(0.59,0.055,0.04),Vector3(-0.42,0.47,0.55),dark)
	box(upper,Vector3(0.04,0.72,0.04),Vector3(-0.78,0.56,0.08),dark)
	box(upper,Vector3(0.06,0.08,0.18),Vector3(-0.8,0.13,0.2),Color("#cbd3d8"))
	box(upper,Vector3(0.8,0.15,1.0),Vector3(-0.42,1.05,0.1),dark)
	box(upper,Vector3(0.69,0.07,0.88),Vector3(-0.42,1.16,0.1),Color("#525a65"))
	box(upper,Vector3(0.58,0.04,0.76),Vector3(-0.42,1.215,0.1),Color("#636b77"))
	box(upper,Vector3(0.18,0.04,0.09),Vector3(-0.68,1.05,0.65),Color("#ffe8ac"))
	for n in range(2):
		box(upper,Vector3(0.25,0.055,0.45),Vector3(-0.82,-0.35-n*0.15,0.05),dark)
	box(upper,Vector3(0.18,0.4,0.18),Vector3(0.4,0.3,-0.8),dark)
	var team_band := box(upper,Vector3(1.55,0.18,0.1),Vector3(0,-0.15,-1.12),Color(COLORS[int(p.team)]))
	team_band.set_meta("dynamic_mesh",true)
	for side in [-1,1]:
		box(upper,Vector3(0.12,0.12,0.025),Vector3(side*0.6,0.02,-1.14),Color("#f67452"))
	var driver_number := label3(upper,str(index+1),Vector3(0.38,0.84,-0.55),Color("#ffffff"),40)
	driver_number.no_depth_test = false
	var boom := Node3D.new()
	upper.add_child(boom)
	stepped_beam(boom,2.4,0.35,0.32,0.28,yellow)
	axle(boom,0.23,0.48,Vector3.ZERO, yellow.darkened(0.15))
	axle(boom,0.1,0.5,Vector3.ZERO,dark)
	var stick := Node3D.new()
	stick.position.z = 2.4
	boom.add_child(stick)
	stepped_beam(stick,2.1,0.26,0.28,0.1,yellow)
	axle(stick,0.2,0.4,Vector3.ZERO,yellow.darkened(0.12))
	axle(stick,0.09,0.43,Vector3.ZERO,dark)
	var bucket := Node3D.new()
	bucket.position.z = 2.1
	stick.add_child(bucket)
	axle(bucket,0.12,0.43,Vector3.ZERO,dark)
	box(bucket,Vector3(0.95,0.12,0.7),Vector3(0,0,-0.2),dark)
	box(bucket,Vector3(0.95,0.45,0.1),Vector3(0,0.23,0.13),dark)
	for side in [-1,1]:
		for section in range(4):
			var height := 0.46-section*0.085
			box(bucket,Vector3(0.1,height,0.18),Vector3(side*0.45,height/2, 0.06-section*0.18),dark.lightened(section*0.025))
		box(bucket,Vector3(0.11,0.08,0.65),Vector3(side*0.45,0.065,-0.2),Color("#626874"))
	for tooth in range(4):
		box(bucket,Vector3(0.12,0.09,0.26),Vector3(-0.33+tooth*0.22,-0.02,-0.6),Color("#85868a"))
	var dirt := box(bucket,Vector3(0.7,0.27,0.4),Vector3(0,0.16,-0.15),Color("#c29652"))
	dirt.set_meta("dynamic_mesh",true)
	var marker := label3(root,str(index+1)+" · "+str(p.name),Vector3(0,3.6,0),Color(COLORS[int(p.team)]),48)
	var model := {"root":root,"upper":upper,"boom":boom,"stick":stick,"bucket":bucket,"dirt":dirt,"marker":marker,"team_band":team_band,"number":driver_number,"paint_material":paint_material,"boom_ram":ram(upper),"stick_ram":ram(boom),"bucket_ram":ram(stick)}
	merge_static_parts(root,paint_material)
	return model

func teams_changed(count: int) -> void:
	for item in team_nodes:
		item.root.queue_free()
	team_nodes.clear()
	team_count = count
	for i in range(count):
		var angle := float(i)/count*TAU
		var root := Node3D.new()
		root.position = Vector3(sin(angle)*float(arena.teamRadius),0,cos(angle)*float(arena.teamRadius))
		add_child(root)
		box(root,Vector3(6.2,0.05,6.2),Vector3(0,0.025,0),Color(COLORS[i]).darkened(0.35))
		for side in [-1,1]:
			box(root,Vector3(6.2,0.09,0.12),Vector3(0,0.08,side*3.1),Color(COLORS[i]))
			box(root,Vector3(0.12,0.09,6.2),Vector3(side*3.1,0.08,0),Color(COLORS[i]))
		var mound := pile(2.5,Color("#c29652"))
		root.add_child(mound)
		var title := label3(root,"팀 "+str(i+1),Vector3(0,3.4,0),Color(COLORS[i]),64)
		team_nodes.append({"root":root,"pile":mound,"label":title})

func accept_state(m: Dictionary) -> void:
	state = m
	update_lobby(m)
	if m.has("connection"):
		var key := str(m.connection.room) + str(m.connection.address) + str(m.connection.get("internetStatus", "local"))
		if key != connection_key:
			connection_key = key
			fetch_config()
	if int(m.teamCount) != team_count:
		teams_changed(int(m.teamCount))
	center_pile.scale.y = maxf(0.025,float(m.central)/4000.0)
	center_pile.visible = float(m.central)>0
	var loose_present := {}
	for s in m.get("groundPiles",[]):
		var pile_id := int(s.id)
		loose_present[pile_id] = true
		if not ground_piles.has(pile_id):
			var mound := pile(float(s.radius),Color("#c29652"))
			add_child(mound)
			ground_piles[pile_id] = mound
		var mound: Node3D = ground_piles[pile_id]
		mound.position = Vector3(float(s.x),0,float(s.z))
		mound.scale.y = clampf(float(s.dirt)/40.0,0.05,2.5)
	for pile_id in ground_piles.keys():
		if not loose_present.has(pile_id):
			ground_piles[pile_id].queue_free()
			ground_piles.erase(pile_id)
	for t in m.teams:
		var item: Dictionary = team_nodes[int(t.id)]
		item.pile.visible = float(t.dirt) > 0
		item.pile.scale.y = clampf(float(t.dirt)/400.0,0.05,2.5)
		item.label.text = "팀 %d · %d" % [int(t.id)+1,int(t.dirt)]
	var present := {}
	for i in range(m.players.size()):
		var p: Dictionary = m.players[i]
		present[p.id] = true
		if not machines.has(p.id):
			machines[p.id] = excavator(p,i)
	for id in machines.keys():
		if not present.has(id):
			machines[id].root.queue_free()
			machines.erase(id)
	var phase_text := "대기실" if m.phase == "lobby" else ("경기 종료" if m.phase == "finished" else "%02d:%02d" % [int(m.remaining)/60,int(m.remaining)%60])
	status.text = phase_text
	status.modulate = Color("#ff957c") if m.phase == "running" and float(m.remaining) <= 30.0 else Color.WHITE
	attendance.text = "참가 %d / 16명" % m.players.size()
	var rankings: Array = m.teams.duplicate()
	rankings.sort_custom(func(a,b): return a.dirt > b.dirt)
	scores.clear()
	scores.push_color(Color("#eef4f6"))
	scores.add_text("팀 순위 · 모래 운반량\n\n")
	scores.pop()
	var rank := 1
	for t in rankings:
		scores.push_color(Color(COLORS[int(t.id)]))
		scores.add_text("%02d  팀 %d" % [rank,int(t.id)+1])
		scores.pop()
		scores.add_text("   %5d\n" % int(t.dirt))
		rank += 1
	if m.phase == "finished":
		var winners: Array = rankings.filter(func(t):return t.dirt == rankings[0].dirt)
		hint.text = "우승: " + ", ".join(winners.map(func(t):return "팀 " + str(int(t.id)+1)))
	elif m.phase == "lobby":
		hint.text = "QR로 참가 → 게임 안에서 팀 설정 → 경기 시작"
	else:
		hint.text = "우리 구역을 채우거나 상대 모래를 가져와 구역 밖에 버리세요"

func _process(delta: float) -> void:
	elapsed += delta
	if not preview_mode:
		socket.poll()
	if not preview_mode and socket.get_ready_state() == WebSocketPeer.STATE_CLOSED and elapsed-last_connect > 2.0:
		last_connect = elapsed
		authenticated = false
		admin_key = ""
		lock_lobby()
		socket.remove_meta("joined")
		fetch_config()
		socket.connect_to_url(server_url.replace("https://","wss://").replace("http://","ws://"))
	elif socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		if not socket.has_meta("joined"):
			if not admin_key.is_empty():
				socket.send_text(JSON.stringify({"type":"host","key":admin_key}))
				socket.set_meta("joined",true)
			elif elapsed-last_config > 2.0:
				fetch_config()
		while socket.get_available_packet_count() > 0:
			var message = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if message is Dictionary and message.get("type") == "host-ready":
				authenticated = true
				lobby_message.text = ""
			elif message is Dictionary and message.get("type") == "state" and authenticated:
				network_updates += 1
				accept_state(message)
			elif message is Dictionary and message.get("type") == "chat-history" and authenticated:
				chat_messages = message.get("messages",[])
				render_chat()
			elif message is Dictionary and message.get("type") == "chat" and authenticated:
				chat_messages.append(message.message)
				while chat_messages.size() > 50:
					chat_messages.pop_front()
				render_chat()
			elif message is Dictionary and message.get("type") == "error":
				lobby_message.text = str(message.message)
				if not authenticated:
					socket.close()
	elif not preview_mode:
		socket.remove_meta("joined")
		authenticated = false
		lock_lobby()
		status.text = "연결 중"
	if not state.is_empty():
		for p in state.players:
			if not machines.has(p.id):
				continue
			var node: Dictionary = machines[p.id]
			var ceremony: bool = state.phase == "finished" and state.get("results") is Dictionary and not state.results.winnerIds.is_empty()
			var stage_height := maxf(0.0,(float(arena.driveLimit)-float(p.z))/6.0)*2.4 if ceremony else 0.0
			node.root.position = node.root.position.lerp(Vector3(p.x,stage_height,p.z),minf(1,delta*15))
			node.root.visible = not ceremony or state.results.winnerIds.has(p.team)
			node.root.rotation.y = lerp_angle(node.root.rotation.y,p.yaw,minf(1,delta*15))
			node.upper.rotation.y = lerp_angle(node.upper.rotation.y,p.turret,minf(1,delta*15))
			node.boom.rotation.x = -float(p.boom)
			node.stick.rotation.x = -float(p.stick)
			node.bucket.rotation.x = float(p.curl)-PI/2
			update_ram(node.boom_ram,Vector3(0,0.05,0.35),node.upper.to_local(node.boom.to_global(Vector3(0,0.18,1.55))))
			update_ram(node.stick_ram,Vector3(0,0.43,0.65),node.boom.to_local(node.stick.to_global(Vector3(0,0.3,0.7))))
			update_ram(node.bucket_ram,Vector3(0,0.25,0.5),node.stick.to_local(node.bucket.to_global(Vector3(0,0.3,-0.15))))
			node.dirt.visible = int(p.cargo)>0
			node.team_band.material_override.albedo_color = Color(COLORS[int(p.team)])
			node.paint_material.set_shader_parameter("team_color",Color(COLORS[int(p.team)]))
			node.number.text = str(state.players.find(p)+1)
			node.marker.modulate = Color(COLORS[int(p.team)])
			node.marker.text = "%d · %s%s" % [state.players.find(p)+1,p.name," (OFFLINE)" if not p.connected else ""]
		var showing_results: bool = state.phase == "finished" and state.get("results") is Dictionary and not state.results.winnerIds.is_empty()
		for team in team_nodes:
			team.root.visible = state.phase != "finished"
			team.label.visible = not showing_results
			team.pile.visible = state.phase != "finished" and float(state.teams[team_nodes.find(team)].dirt) > 0.0
		for visual in arena_visuals:
			visual.visible = not showing_results if visual is Label3D else true
		center_pile.visible = state.phase != "finished" and float(state.central) > 0.0
		for loose in ground_piles.values():
			loose.visible = state.phase != "finished"
	if "--capture" in OS.get_cmdline_user_args() and elapsed > 3 and not capture_done:
		capture_done = true
		capture.call_deferred()

func capture() -> void:
	await RenderingServer.frame_post_draw
	var filename := "model-preview.png" if "--model-preview" in OS.get_cmdline_user_args() else capture_name
	get_viewport().get_texture().get_image().save_png("res://../.runtime/" + filename)
	var metrics := {"players":state.get("players",[]).size(),"phase":state.get("phase","offline"),"network_updates":network_updates,"qr_ready":qr.texture!=null,"fps":Performance.get_monitor(Performance.TIME_FPS),"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"objects":Performance.get_monitor(Performance.OBJECT_NODE_COUNT)}
	var file := FileAccess.open("res://../.runtime/render-metrics.json",FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(metrics))
	print("Render sample: ",JSON.stringify(metrics))
	get_tree().quit()

func make_ui() -> void:
	var canvas := CanvasLayer.new()
	add_child(canvas)
	var ui := Control.new()
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme := Theme.new()
	theme.default_font = GAME_FONT
	theme.default_font_size = 24
	apply_worksite_theme(theme)
	ui.theme = theme
	ui.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	canvas.add_child(ui)
	var heading_bg := hud_panel()
	heading_bg.position = Vector2(20,16)
	heading_bg.size = Vector2(290,88)
	ui.add_child(heading_bg)
	var top := Label.new()
	top.text = "플레이룸"
	top.position = Vector2(36,24)
	style_label(top,30,Color("#faad28"))
	ui.add_child(top)
	attendance = Label.new()
	attendance.position = Vector2(36,65)
	style_label(attendance,20,Color("#eef4f6"))
	ui.add_child(attendance)
	var clock_panel := hud_panel()
	ui.add_child(clock_panel)
	clock_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	clock_panel.offset_left = -110
	clock_panel.offset_right = 110
	clock_panel.offset_top = 16
	clock_panel.offset_bottom = 104
	var clock_caption := Label.new()
	clock_caption.text = "남은 시간"
	clock_caption.position = Vector2(0,8)
	clock_caption.size = Vector2(220,24)
	clock_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	style_label(clock_caption,19,Color("#eef4f6"))
	clock_panel.add_child(clock_caption)
	status = Label.new()
	status.position = Vector2(0,34)
	status.size = Vector2(220,42)
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	style_label(status,34)
	clock_panel.add_child(status)
	var score_panel := PanelContainer.new()
	score_panel.position = Vector2(20,120)
	score_panel.custom_minimum_size = Vector2(260,0)
	var score_style := hud_style()
	score_style.content_margin_left = 16
	score_style.content_margin_right = 16
	score_style.content_margin_top = 12
	score_style.content_margin_bottom = 16
	score_panel.add_theme_stylebox_override("panel",score_style)
	ui.add_child(score_panel)
	scores = RichTextLabel.new()
	scores.custom_minimum_size.x = 228
	scores.fit_content = true
	scores.scroll_active = false
	scores.add_theme_font_size_override("normal_font_size",23)
	style_hud_text(scores)
	score_panel.add_child(scores)
	var bottom := hud_panel()
	ui.add_child(bottom)
	bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_left = 20
	bottom.offset_right = -20
	bottom.offset_top = -76
	bottom.offset_bottom = -16
	hint = Label.new()
	ui.add_child(hint)
	hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	hint.offset_left = 36
	hint.offset_right = -440
	hint.offset_top = -70
	hint.offset_bottom = -22
	hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	style_label(hint,20,Color("#dce2dd"))
	var join_panel := hud_panel()
	ui.add_child(join_panel)
	join_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	join_panel.offset_left = -324
	join_panel.offset_right = -20
	join_panel.offset_top = 16
	join_panel.offset_bottom = 288
	qr = TextureRect.new()
	ui.add_child(qr)
	qr.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	qr.offset_left = -254
	qr.offset_right = -54
	qr.offset_top = 30
	qr.offset_bottom = 230
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	join_label = Label.new()
	ui.add_child(join_label)
	join_label.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	join_label.offset_left = -312
	join_label.offset_right = -32
	join_label.offset_top = 236
	join_label.offset_bottom = 284
	join_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	style_label(join_label,16)
	var manage := Button.new()
	manage.text = "대기실 / 팀 설정"
	ui.add_child(manage)
	manage.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	manage.offset_left = -246
	manage.offset_right = -32
	manage.offset_top = -68
	manage.offset_bottom = -24
	manage.pressed.connect(func():lobby_panel.visible = not lobby_panel.visible)
	style_hud_button(manage)
	var fullscreen := Button.new()
	fullscreen.text = "전체화면 F11"
	ui.add_child(fullscreen)
	fullscreen.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	fullscreen.offset_left = -426
	fullscreen.offset_right = -258
	fullscreen.offset_top = -68
	fullscreen.offset_bottom = -24
	fullscreen.pressed.connect(toggle_fullscreen)
	style_hud_button(fullscreen)
	make_lobby(ui)
	make_results(ui)
	# Keep the entire join card in step with every way of opening/closing the lobby.
	lobby_panel.visibility_changed.connect(func():
		join_panel.visible = lobby_panel.visible
		qr.visible = lobby_panel.visible
		join_label.visible = lobby_panel.visible
	)
	join_panel.visible = lobby_panel.visible
	qr.visible = lobby_panel.visible
	join_label.visible = lobby_panel.visible
	chat_panel = PanelContainer.new()
	ui.add_child(chat_panel)
	chat_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	chat_panel.offset_left = 20
	chat_panel.offset_right = 460
	chat_panel.offset_top = -222
	chat_panel.offset_bottom = -88
	var chat_style := hud_style()
	chat_style.content_margin_left = 12
	chat_style.content_margin_right = 12
	chat_style.content_margin_top = 8
	chat_style.content_margin_bottom = 8
	chat_panel.add_theme_stylebox_override("panel",chat_style)
	var chat_content := VBoxContainer.new()
	chat_content.add_theme_constant_override("separation",8)
	chat_panel.add_child(chat_content)
	var chat_title := Label.new()
	chat_title.text = "전체 채팅"
	style_label(chat_title,17,Color("#e8b645"))
	chat_content.add_child(chat_title)
	chat_log = RichTextLabel.new()
	chat_log.custom_minimum_size = Vector2(416,84)
	chat_log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	chat_log.bbcode_enabled = false
	chat_log.scroll_following = true
	chat_log.add_theme_font_size_override("normal_font_size",20)
	style_hud_text(chat_log)
	chat_content.add_child(chat_log)
	render_chat()

func render_chat() -> void:
	chat_log.clear()
	if chat_messages.is_empty():
		chat_log.push_color(Color("#eef4f6"))
		chat_log.add_text("휴대폰에서 메시지를 보내세요.")
		chat_log.pop()
	for message in chat_messages:
		chat_log.push_color(Color("#e8b645"))
		chat_log.add_text(str(message.get("name","플레이어")) + "  ")
		chat_log.pop()
		chat_log.add_text(str(message.get("text","")) + "\n")

func lobby_button(text: String, parent: Node, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size.y = 44
	button.pressed.connect(action)
	parent.add_child(button)
	return button

func make_results(ui: Control) -> void:
	result_panel = PanelContainer.new()
	ui.add_child(result_panel)
	result_panel.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	result_panel.offset_left = 20
	result_panel.offset_right = 350
	result_panel.offset_top = 118
	result_panel.offset_bottom = -160
	var panel_style := worksite_style(Color("#242b24"),Color("#e8b645"))
	panel_style.content_margin_left = 16
	panel_style.content_margin_right = 16
	panel_style.content_margin_top = 16
	panel_style.content_margin_bottom = 16
	result_panel.add_theme_stylebox_override("panel",panel_style)
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation",16)
	result_panel.add_child(layout)
	var caption := Label.new()
	caption.text = "작업 완료! · 경기 결과"
	style_label(caption,18,Color("#b9c5ab"))
	layout.add_child(caption)
	result_title = Label.new()
	style_label(result_title,26,Color("#ffe1a0"))
	result_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	layout.add_child(result_title)
	result_body = RichTextLabel.new()
	result_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	result_body.add_theme_font_size_override("normal_font_size",20)
	style_hud_text(result_body)
	layout.add_child(result_body)
	var note := Label.new()
	note.text = "운반: 우리 팀에 내려놓은 누적량\n방해: 상대 팀에서 퍼낸 누적량\n반복 작업 포함 · 개인 순위는 운반량\n우승 팀은 조이스틱으로 세리머니!"
	style_label(note,14,Color("#b9c5ab"))
	layout.add_child(note)
	result_return = lobby_button("다음 경기 준비",layout,func():send_admin({"type":"lobby"}))
	result_panel.hide()

func update_results(m: Dictionary) -> void:
	var results = m.get("results")
	if m.phase != "finished" or not results is Dictionary:
		result_panel.hide()
		ceremony_stage.hide()
		result_backdrop.hide()
		match_environment.background_mode = Environment.BG_COLOR
		chat_panel.show()
		if not result_signature.is_empty():
			camera.projection = Camera3D.PROJECTION_ORTHOGONAL
			camera.size = float(arena.cameraSize)
			camera.h_offset = 0.0
			camera.position = Vector3(34,40,42)
			camera.look_at(Vector3.ZERO)
			center_pile.show()
			for team in team_nodes:
				team.root.show()
		result_signature = ""
		return
	result_return.disabled = not authenticated or preview_mode
	var signature := JSON.stringify(results)
	if signature == result_signature:
		return
	result_signature = signature
	result_panel.show()
	chat_panel.hide()
	if not results.winnerIds.is_empty():
		result_backdrop.show()
		match_environment.background_mode = Environment.BG_SKY
		var count: int = results.players.filter(func(p):return results.winnerIds.has(p.team)).size()
		var rows := ceili(float(count)/4.0)
		ceremony_stage.visible = rows > 1
		for index in range(ceremony_steps.size()):
			ceremony_steps[index].visible = index+1 < rows
		var target := Vector3(0,1.6+(rows-1)*1.2,float(arena.driveLimit)-(rows-1)*3)
		camera.size = maxf(13.0,min(count,4)*5.0+3.0)+(rows-1)*1.5
		camera.h_offset = -camera.size*0.18
		camera.projection = Camera3D.PROJECTION_PERSPECTIVE
		camera.fov = 42.0
		camera.position = target + Vector3(0,1.6,camera.size*1.3)
		camera.look_at(target)
	var names: Array = results.winnerIds.map(func(id):return "팀 %d" % (int(id)+1))
	result_title.text = "이번 경기는 무승부" if names.is_empty() else " · ".join(names) + (" 공동 우승!" if names.size() > 1 else " 우승!")
	result_body.clear()
	result_body.add_text("최종 확보 모래 %d점\n\n팀 최종 순위\n" % int(results.total))
	for team in results.teams:
		result_body.push_color(Color(COLORS[int(team.id)]))
		result_body.add_text("%d위   팀 %d" % [int(team.rank),int(team.id)+1])
		result_body.pop()
		result_body.add_text("    %d점\n" % int(team.score))
	result_body.add_text("\n개인 운반 기록\n")
	for player in results.players:
		result_body.push_color(Color(COLORS[int(player.team)]))
		result_body.add_text("%d위   %s · 팀 %d" % [int(player.rank),str(player.name),int(player.team)+1])
		result_body.pop()
		result_body.add_text("\n     운반 %d · 방해 %d\n" % [int(player.score),int(player.get("disrupted",0))])
	result_body.scroll_to_line(0)
	var tween := create_tween()
	result_panel.modulate.a = 0.0
	tween.tween_property(result_panel,"modulate:a",1.0,0.4)

func make_lobby(ui: Control) -> void:
	lobby_panel = PanelContainer.new()
	ui.add_child(lobby_panel)
	lobby_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	lobby_panel.offset_left = -500
	lobby_panel.offset_right = 460
	lobby_panel.offset_top = -308
	lobby_panel.offset_bottom = 308
	var panel_style := worksite_style(Color("#292d26"),Color("#758064"))
	panel_style.content_margin_left = 24
	panel_style.content_margin_right = 24
	panel_style.content_margin_top = 20
	panel_style.content_margin_bottom = 20
	lobby_panel.add_theme_stylebox_override("panel",panel_style)
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation",12)
	lobby_panel.add_child(layout)
	var header := HBoxContainer.new()
	layout.add_child(header)
	lobby_title = Label.new()
	lobby_title.text = "대기실 · 서버 연결 중"
	lobby_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	style_label(lobby_title,30,Color("#faad28"))
	header.add_child(lobby_title)
	lobby_button("닫기",header,func():lobby_panel.hide())
	var settings := HBoxContainer.new()
	settings.add_theme_constant_override("separation",12)
	layout.add_child(settings)
	var team_label := Label.new()
	team_label.text = "팀 수"
	settings.add_child(team_label)
	team_select = OptionButton.new()
	for count in range(1,9):
		team_select.add_item("%d개" % count,count)
	settings.add_child(team_select)
	var time_label := Label.new()
	time_label.text = "경기 시간 (초)"
	settings.add_child(time_label)
	duration_input = SpinBox.new()
	duration_input.min_value = 30
	duration_input.max_value = 900
	duration_input.step = 1
	duration_input.value = 180
	duration_input.custom_minimum_size.x = 150
	settings.add_child(duration_input)
	configure_button = lobby_button("적용 / 균등 배정",settings,func():
		duration_input.apply()
		send_admin({"type":"configure","teams":team_select.get_selected_id(),"duration":duration_input.value})
	)
	var network_row := HBoxContainer.new()
	layout.add_child(network_row)
	var network_label := Label.new()
	network_label.text = "폰 접속 주소  "
	network_row.add_child(network_label)
	network_select = OptionButton.new()
	network_select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	network_row.add_child(network_select)
	network_select.item_selected.connect(func(index):send_admin({"type":"network","address":network_select.get_item_text(index)}))
	connection_help = Label.new()
	connection_help.text = "QR을 스캔해서 참가하세요."
	style_label(connection_help,20)
	layout.add_child(connection_help)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	layout.add_child(scroll)
	player_list = VBoxContainer.new()
	player_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	player_list.add_theme_constant_override("separation",8)
	scroll.add_child(player_list)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation",12)
	layout.add_child(actions)
	start_button = lobby_button("경기 시작",actions,func():send_admin({"type":"start"}))
	start_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	start_button.add_theme_stylebox_override("normal",worksite_style(Color("#e8b645"),Color("#ffe1a0")))
	start_button.add_theme_stylebox_override("hover",worksite_style(Color("#f5ca65"),Color("#fff0c2")))
	start_button.add_theme_color_override("font_color",Color("#27281f"))
	start_button.add_theme_color_override("font_hover_color",Color("#27281f"))
	return_button = lobby_button("대기실로 돌아가기",actions,func():
		if state.get("phase") == "running":
			reset_dialog.popup_centered()
		else:
			send_admin({"type":"lobby"})
	)
	lobby_message = Label.new()
	lobby_message.text = "서버 연결 중 · 잠시 기다려주세요"
	lobby_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lobby_message.custom_minimum_size.y = 28
	style_label(lobby_message,20,Color("#ffbd87"))
	layout.add_child(lobby_message)
	reset_dialog = ConfirmationDialog.new()
	reset_dialog.title = "경기를 종료하고 대기실로 돌아갈까요?"
	reset_dialog.dialog_text = "현재 점수와 남은 시간이 초기화됩니다. 참가자와 팀 배정은 유지됩니다."
	reset_dialog.ok_button_text = "대기실로 돌아가기"
	reset_dialog.cancel_button_text = "계속 경기"
	reset_dialog.confirmed.connect(func():send_admin({"type":"lobby"}))
	ui.add_child(reset_dialog)
	lock_lobby()

func lock_lobby() -> void:
	team_select.disabled = true
	duration_input.editable = false
	configure_button.disabled = true
	start_button.disabled = true
	return_button.disabled = true
	network_select.disabled = true
	for control in player_controls:
		control.disabled = true
	if lobby_message != null:
		lobby_message.text = "서버 연결 중 · 잠시 기다려주세요"

func send_admin(message: Dictionary) -> void:
	if not authenticated or preview_mode or socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	lobby_message.text = ""
	socket.send_text(JSON.stringify(message))

func update_lobby(m: Dictionary) -> void:
	update_results(m)
	if preview_mode:
		lobby_message.text = "미리보기 · 실제 설정은 서버에 연결한 뒤 사용할 수 있습니다."
	var phase := str(m.phase)
	if phase != previous_phase:
		lobby_panel.visible = phase == "lobby"
		previous_phase = phase
		reset_dialog.hide()
	var connected := 0
	var roster: Array = []
	for p in m.players:
		if p.connected:
			connected += 1
		roster.append([p.id,p.name,p.team,p.connected])
	lobby_title.text = "%s · %d / 16명 접속" % ["대기실" if phase == "lobby" else ("경기 중" if phase == "running" else "경기 종료"),connected]
	var locked := phase != "lobby" or not authenticated or preview_mode
	team_select.disabled = locked
	duration_input.editable = not locked
	configure_button.disabled = locked
	start_button.disabled = locked or connected == 0
	return_button.disabled = not authenticated or preview_mode or phase == "lobby"
	network_select.disabled = not authenticated or preview_mode
	var settings_key := JSON.stringify([m.teamCount,m.get("duration",180)])
	if settings_key != settings_signature:
		settings_signature = settings_key
		team_select.select(int(m.teamCount)-1)
		duration_input.value = float(m.get("duration",180))
	if m.has("connection"):
		for index in range(network_select.item_count):
			if network_select.get_item_text(index) == str(m.connection.address):
				network_select.select(index)
	var signature := JSON.stringify([m.teamCount,roster])
	if signature != player_signature:
		player_signature = signature
		player_controls.clear()
		for child in player_list.get_children():
			player_list.remove_child(child)
			child.queue_free()
		if m.players.is_empty():
			var empty := Label.new()
			empty.text = "아직 참가자가 없습니다. 오른쪽 QR코드를 스캔하세요."
			style_label(empty,22)
			player_list.add_child(empty)
		for index in range(m.players.size()):
			var p: Dictionary = m.players[index]
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation",12)
			player_list.add_child(row)
			var name := Label.new()
			name.text = "%02d · %s  %s" % [index+1,p.name,"●" if p.connected else "(연결 끊김)"]
			name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			style_label(name,24,Color(COLORS[int(p.team)]))
			row.add_child(name)
			var choice := OptionButton.new()
			choice.custom_minimum_size = Vector2(130,44)
			for team in range(int(m.teamCount)):
				choice.add_item("팀 %d" % (team+1),team)
			choice.select(int(p.team))
			choice.item_selected.connect(func(team):send_admin({"type":"assign","id":p.id,"team":team}))
			row.add_child(choice)
			player_controls.append(choice)
			var remove := lobby_button("제외",row,func():send_admin({"type":"remove","id":p.id}))
			player_controls.append(remove)
	for control in player_controls:
		control.disabled = locked

func worksite_style(fill: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(2)
	style.set_corner_radius_all(0)
	style.shadow_color = Color("#151912")
	style.shadow_size = 3
	style.shadow_offset = Vector2(3,3)
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	return style

func apply_worksite_theme(theme: Theme) -> void:
	for type in ["Button","OptionButton","LineEdit","SpinBox"]:
		theme.set_stylebox("normal",type,worksite_style(Color("#3a4035"),Color("#758064")))
		theme.set_stylebox("hover",type,worksite_style(Color("#4b5340"),Color("#e8b645")))
		theme.set_stylebox("pressed",type,worksite_style(Color("#252a22"),Color("#e8b645")))
		theme.set_stylebox("focus",type,worksite_style(Color(0,0,0,0),Color("#ffe1a0")))
		theme.set_stylebox("disabled",type,worksite_style(Color("#2c3128"),Color("#484e3f")))
		theme.set_color("font_color",type,Color("#f7edd3"))
		theme.set_color("font_hover_color",type,Color("#ffe1a0"))
		theme.set_color("font_disabled_color",type,Color("#858975"))
	theme.set_stylebox("panel","PopupMenu",worksite_style(Color("#292d26"),Color("#758064")))
	theme.set_stylebox("hover","PopupMenu",worksite_style(Color("#4b5340"),Color("#e8b645")))
	theme.set_color("font_color","PopupMenu",Color("#f7edd3"))
	theme.set_stylebox("panel","AcceptDialog",worksite_style(Color("#292d26"),Color("#e8b645")))
	theme.set_color("font_color","Label",Color("#f7edd3"))

func hud_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color.TRANSPARENT
	return style

func style_hud_button(button: Button) -> void:
	button.add_theme_stylebox_override("normal",hud_style())
	button.add_theme_stylebox_override("focus",hud_style())
	var hover := hud_style()
	hover.bg_color = Color(1.0,1.0,1.0,0.08)
	button.add_theme_stylebox_override("hover",hover)
	button.add_theme_stylebox_override("pressed",hover)
	button.add_theme_font_size_override("font_size",18)
	button.add_theme_color_override("font_color",Color("#dce2dd"))
	button.add_theme_color_override("font_outline_color",Color("#080d12"))
	button.add_theme_constant_override("outline_size",4)

func hud_panel() -> Panel:
	var panel := Panel.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel",hud_style())
	return panel

func style_label(label: Label, font_size: int, color := Color("#f7edd3")) -> void:
	label.add_theme_font_size_override("font_size",font_size)
	label.add_theme_color_override("font_color",color)
	style_hud_text(label)

func style_hud_text(control: Control) -> void:
	control.add_theme_color_override("font_outline_color",Color("#080d12"))
	control.add_theme_constant_override("outline_size",4)
	control.add_theme_color_override("font_shadow_color",Color(0.0,0.0,0.0,0.85))
	control.add_theme_constant_override("shadow_offset_x",2)
	control.add_theme_constant_override("shadow_offset_y",2)

func toggle_fullscreen() -> void:
	var full := DisplayServer.window_get_mode() in [DisplayServer.WINDOW_MODE_FULLSCREEN,DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN]
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F11:
			toggle_fullscreen()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_ESCAPE:
			if lobby_panel.visible:
				lobby_panel.hide()
			else:
				DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)

func fetch_config() -> void:
	if config_pending:
		return
	config_pending = true
	last_config = elapsed
	var request := HTTPRequest.new()
	request.timeout = 3.0
	add_child(request)
	request.request_completed.connect(func(a,b,c,d):
		config_pending = false
		config_loaded(a,b,c,d)
		request.queue_free()
	)
	if request.request(server_url + "/config") != OK:
		config_pending = false
		request.queue_free()

func config_loaded(_result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if code != 200:
		return
	var config = JSON.parse_string(body.get_string_from_utf8())
	if not config is Dictionary:
		return
	if config.get("app") != "dirt-rally" or int(config.get("protocol",0)) != 1:
		lobby_message.text = "게임 서버의 버전이 맞지 않습니다."
		return
	admin_key = host_token if config.get("hostAuth", "local") == "token" else (str(config.adminKey) if config.get("adminKey") != null else "")
	if admin_key.is_empty():
		lobby_message.text = "DIRT_RALLY_HOST_KEY에 진행자 키를 설정한 뒤 게임을 다시 실행하세요." if config.get("hostAuth") == "token" else "이 PC의 로컬 서버 주소로 접속해야 팀을 설정할 수 있습니다."
	network_select.clear()
	for address in config.addresses:
		network_select.add_item(str(address))
		if address == config.joinAddress:
			network_select.select(network_select.item_count-1)
	var remote_mode: bool = str(config.joinAddress).begins_with("https://")
	var internet_status: String = str(config.get("internetStatus", "local"))
	network_select.get_parent().visible = config.addresses.size() > 1 or not remote_mode
	connection_help.text = "다른 Wi-Fi / LTE에서도 QR로 참가할 수 있습니다." if remote_mode else "같은 LAN / Wi-Fi에서 QR로 참가하세요."
	if internet_status in ["connecting", "reconnecting"]:
		connection_help.text = "인터넷 연결을 복구하고 있습니다. QR이 바뀌면 다시 스캔하세요."
	elif internet_status == "failed":
		connection_help.text = "인터넷 연결이 끊겼습니다. 같은 LAN / Wi-Fi에서는 참가할 수 있습니다."
	join_label.text = "참가 코드 " + str(config.room)
	join_label.text += "\n" + str(config.joinAddress)
	var request := HTTPRequest.new()
	add_child(request)
	request.request_completed.connect(func(_r,c,_h,b):
		if c == 200:
			var img := Image.new()
			if img.load_svg_from_buffer(b) == OK:
				qr.texture = ImageTexture.create_from_image(img)
		request.queue_free()
	)
	request.request(server_url + "/qr")

func preview() -> void:
	var teams: Array = []
	var players: Array = []
	for i in range(4):
		var a := float(i)/4*TAU
		teams.append({"id":i,"dirt":120+i*40})
		players.append({"id":str(i),"team":i,"name":"DRIVER "+str(i+1),"x":sin(a)*8,"z":cos(a)*8,"yaw":a+PI,"turret":0.3,"boom":0.6,"stick":-1.1,"curl":0.2,"cargo":20,"connected":true})
	if "--model-preview" in OS.get_cmdline_user_args():
		players = [players[0]]
		players[0].x = 0
		players[0].z = 0
		players[0].yaw = 0
		players[0].turret = 0
		players[0].boom = 0.95
		players[0].stick = -1.8
		players[0].curl = 0.2
		players[0].cargo = 0
	accept_state({"teamCount":4,"central":4000,"teams":teams,"players":players,"phase":"lobby","remaining":180})
