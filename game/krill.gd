extends "res://fps.gd"

var models: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://krill-models.json"))
var whale: Node3D
var jaw: Node3D
var mouth_lining: MeshInstance3D
var water_vortex: Node3D
var danger_zone: MeshInstance3D
var obstacles: Dictionary = {}
var reins: MeshInstance3D
var board: Label
var card_mode := false

var model_materials: Dictionary = {}
var model_meshes: Dictionary = {}

func solid_model(data: Dictionary) -> Node3D:
	var root := Node3D.new()
	var joints := {}
	for j in data.joints:
		var node := Node3D.new()
		node.position = Vector3(j.pos[0],j.pos[1],j.pos[2])
		if j.has("rotation"):
			node.rotation = Vector3(j.rotation[0],j.rotation[1],j.rotation[2])
		if j.parent == null:
			root.add_child(node)
		else:
			joints[j.parent].add_child(node)
		joints[j.id] = node
	for p in data.parts:
		var node := MeshInstance3D.new()
		var key := JSON.stringify(p)
		if not model_meshes.has(key):
			if p.shape == "voxel":
				model_meshes[key] = preload("res://brick_model.gd").mesh(p)
			elif p.shape == "box":
				var mesh := BoxMesh.new()
				mesh.size = Vector3(p.size[0],p.size[1],p.size[2])
				model_meshes[key] = mesh
			elif p.shape == "ellipsoid":
				var mesh := SphereMesh.new()
				mesh.radius = .5
				mesh.height = 1
				mesh.radial_segments = 10
				mesh.rings = 7
				model_meshes[key] = mesh
			else:
				var mesh := CylinderMesh.new()
				mesh.top_radius = p.r1
				mesh.bottom_radius = p.r0
				mesh.height = Vector3(p.from[0],p.from[1],p.from[2]).distance_to(Vector3(p.to[0],p.to[1],p.to[2]))
				mesh.radial_segments = 8
				model_meshes[key] = mesh
		node.mesh = model_meshes[key]
		if p.shape == "segment":
			var from := Vector3(p.from[0],p.from[1],p.from[2])
			var to := Vector3(p.to[0],p.to[1],p.to[2])
			node.position = (from+to)*.5
			node.quaternion = Quaternion(Vector3.UP,(to-from).normalized())
		elif p.shape != "voxel":
			node.position = Vector3(p.pos[0],p.pos[1],p.pos[2])
			if p.shape == "ellipsoid":
				node.scale = Vector3(p.size[0],p.size[1],p.size[2])
		var color: String = "#ffffff" if p.shape == "voxel" else p.color
		if not model_materials.has(color):
			var material := StandardMaterial3D.new()
			material.albedo_color = Color(color)
			material.vertex_color_use_as_albedo = p.shape == "voxel"
			material.roughness = .85
			model_materials[color] = material
		node.material_override = model_materials[color]
		joints[p.joint].add_child(node)
	root.set_meta("joints",joints)
	return root

func setup_whale_mouth() -> void:
	jaw = whale.get_meta("joints").jaw
	mouth_lining = MeshInstance3D.new()
	var lining_material := StandardMaterial3D.new()
	lining_material.albedo_color = Color("#17232e")
	lining_material.roughness = .95
	lining_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	mouth_lining.material_override = lining_material
	whale.add_child(mouth_lining)
	pose_whale_mouth(0)

func pose_whale_mouth(opening: float) -> void:
	var amount := clampf(opening,0,1)
	var mouth: Dictionary = models.whale.mouth
	jaw.rotation.x = amount*amount*(3-2*amount)*float(mouth.maxAngle)
	mouth_lining.visible = amount > .025
	if not mouth_lining.visible:
		return
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(16):
		var points: Array[Vector3] = []
		for step in [i,i+1]:
			var angle: float = PI*step/16
			var upper := Vector3(cos(angle)*float(mouth.halfWidth),float(mouth.rimY),float(mouth.rimZ)+sin(angle)*float(mouth.rimDepth))
			var lower := jaw.transform*Vector3(upper.x,float(mouth.lowerY),upper.z-jaw.position.z)
			points.append(upper)
			points.append(lower)
		for index in [0,1,2,2,1,3]:
			surface.add_vertex(points[index])
	surface.generate_normals()
	mouth_lining.mesh = surface.commit()

func whale_point(values: Array) -> Vector3:
	return Vector3(values[0],values[1],values[2])

func update_krill_camera() -> void:
	var riding: bool = state.get("phase") == "finished" and not state.results.winnerIds.is_empty()
	if riding:
		var target := whale.position+whale_point(models.whale.cameraTarget)
		var viewport_size := get_viewport().get_visible_rect().size
		var fit := maxf(1,1.5/(viewport_size.x/maxf(1,viewport_size.y)))
		camera.position = target+whale_point(models.whale.cameraOffset)*fit
		camera.look_at(target)
	else:
		camera.position = Vector3(0,0,29)
		camera.look_at(Vector3(0,0,-3))

func animate_models(delta: float) -> void:
	var joints: Dictionary = whale.get_meta("joints")
	water_vortex.animate(elapsed,float(state.get("krill",{}).get("opening",0)),state.get("phase") == "running",delta,jaw.rotation.x)
	joints.tail.rotation.x = sin(elapsed*1.6)*.13
	joints.finL.rotation.z = sin(elapsed*1.8)*.08
	joints.finR.rotation.z = -joints.finL.rotation.z
	for p in state.get("players",[]):
		if not actors.has(p.id):
			continue
		var j: Dictionary = actors[p.id].get_meta("joints")
		var moving: bool = state.get("phase") == "running" and p.alive
		var swim_x: float = p.get("swimX",0) if moving else 0.0
		var swim_y: float = p.get("swimY",0) if moving else 0.0
		var blend := 1-exp(-12*delta)
		j.body.rotation.x = lerp_angle(j.body.rotation.x,-swim_y*.16,blend)
		j.body.rotation.y = lerp_angle(j.body.rotation.y,PI/2+swim_x*.22,blend)
		j.body.rotation.z = lerp_angle(j.body.rotation.z,-swim_x*.14,blend)
		var wave := sin(elapsed*9+str(p.id).length())
		j.tail.rotation.y = sin(elapsed*26)*.65 if p.tail > 0 else wave*.12
		j.antennaL.rotation.z = wave*.055
		j.antennaR.rotation.z = -wave*.055
		j.legsL.rotation.x = wave*.22
		j.legsR.rotation.x = -wave*.22

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
	whale = solid_model(models.whale)
	add_child(whale)
	whale.position = Vector3(0,2,-17)
	whale.scale = Vector3.ONE*1.5
	setup_whale_mouth()
	water_vortex = preload("res://whale_vortex.gd").new()
	whale.add_child(water_vortex)
	danger_zone = MeshInstance3D.new()
	var danger_mesh := QuadMesh.new()
	danger_mesh.size = Vector2(200,200)
	danger_zone.mesh = danger_mesh
	var danger_shader := Shader.new()
	danger_shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
uniform vec2 safe_center = vec2(0.0);
uniform float safe_radius = 2.8;
uniform float intensity = 0.18;
varying vec2 field_position;
void vertex() { field_position = VERTEX.xy; }
void fragment() {
 float outside = distance(field_position,safe_center)-safe_radius;
 if (outside <= 0.0) { discard; }
 float stripe = step(0.9,fract((field_position.x+field_position.y)*0.45));
 float edge = 1.0-smoothstep(0.04,0.16,outside);
 float pulse = 0.92+0.08*sin(TIME*5.0);
 ALBEDO = mix(vec3(1.0,0.18,0.12),vec3(1.0,0.65,0.2),max(stripe,edge));
 ALPHA = max(intensity*(0.3+stripe*0.35),edge*0.75)*pulse;
}
"""
	var danger_material := ShaderMaterial.new()
	danger_material.shader = danger_shader
	danger_zone.material_override = danger_material
	danger_zone.position.z = -.15
	danger_zone.visible = false
	add_child(danger_zone)
	reins = MeshInstance3D.new()
	var rope_material := StandardMaterial3D.new()
	rope_material.albedo_color = Color("#ffe7a6")
	rope_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rope_material.no_depth_test = true
	reins.material_override = rope_material
	add_child(reins)
	for i in range(130):
		block(self,Vector3(.05,.05,.05),Vector3(sin(i*12.7)*28,cos(i*2.3)*17,-27+(i%35)),Color("#4b879b"))
	build_ui()
	score_strip.add_child(match_clock)
	status.text = "KRILL ESCAPE · 크릴 생존"
	ranking.text = "왼쪽 패드 이동 · 오른쪽 꼬리치기 · 경고 무늬는 흡입 위험 · 무늬 없는 곳으로 이동"
	lobby_title.text = "KRILL ESCAPE / 대기실"
	lobby_hint.text = "작은 크릴, 거대한 고래 · 개인 생존"
	teams_input.hide()
	teams_input.get_parent().get_child(0).hide()
	configure_button.text = "경기 시간 적용"
	start_button.text = "▶ 크릴 생존 시작"
	board = text_label("",18)
	board.position = Vector2(24,130)
	lobby.get_parent().add_child(board)
	fetch_config()
	if card_mode:
		set_process(false)
		lobby.get_parent().hide()
		var actor := solid_model(models.krill)
		actor.scale = Vector3.ONE*3
		actor.position = Vector3(3,-2,4)
		add_child(actor)
		danger_zone.hide()
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://assets/krill-card.png")
		get_tree().quit()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--krill-fixture="):
			set_process(false)
			accept_state(JSON.parse_string(FileAccess.get_file_as_string(arg.trim_prefix("--krill-fixture="))))
			animate_models(.2)
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
	whale.position = Vector3(k.ride.x,-2+k.ride.y,-12) if finished else Vector3(0,2,-17)
	whale.scale = Vector3.ONE*(1.1 if finished else 1.5)
	whale.rotation.y = k.ride.yaw if finished else 0.0
	update_krill_camera()
	var opening: float = .08 if finished else k.get("opening",0)
	pose_whale_mouth(opening)
	danger_zone.visible = phase == "running" and k.stage != "rest"
	var material: ShaderMaterial = danger_zone.material_override
	material.set_shader_parameter("safe_center",Vector2(k.safe.x,k.safe.y))
	material.set_shader_parameter("safe_radius",k.safe.r)
	material.set_shader_parameter("intensity",.3 if k.stage == "suction" else .18)
	status.text = "KRILL ESCAPE · " + ("대기실" if phase == "lobby" else "경고 영역 흡입 중!" if k.stage == "suction" else "흡입 예고! 경고 무늬를 피하세요" if k.stage == "warning" else "바다 속 생존")
	var rows := PackedStringArray()
	for p in message.players:
		if not actors.has(p.id):
			var actor := solid_model(models.krill)
			var marker := Label3D.new()
			marker.name = "Marker"
			marker.font = FONT
			marker.font_size = 34
			marker.pixel_size = .015
			marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			marker.position.y = 1.05
			marker.modulate = Color(p.color)
			actor.add_child(marker)
			actors[p.id] = actor
			add_child(actor)
		var actor: Node3D = actors[p.id]
		actor.visible = p.id == winner if finished else (phase == "lobby" or (p.participating and p.alive))
		actor.position = whale.to_global(whale_point(models.whale.rider)) if finished else Vector3(p.x,p.y,-p.suction*6)
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
			surface.add_vertex(whale.to_global(whale_point(models.whale.rider)))
			surface.add_vertex(whale.to_global(whale_point(models.whale.reinAnchors[0 if side < 0 else 1])))
		reins.mesh = surface.commit()
		status.text = "고래의 주인! · 휴대폰 패드로 고래를 조종하세요"
	board.visible = phase != "lobby"
	board.text = "\n".join(rows)
	if finished:
		board.text = "\n".join(message.results.players.map(func(p):return "%d위 · %s · %.1f초" % [p.rank,p.name,p.survival]))
		if winner.is_empty():
			status.text = "경기 종료 · 생존자 없음"
	preload("res://lobby_ui.gd").sync(lobby,phase)
	start_button.disabled = not authenticated or phase != "lobby" or not message.players.any(func(p):return p.connected)
	return_button.disabled = not authenticated
	time_input.editable = authenticated and phase == "lobby"
	time_input.value = message.duration
	configure_button.disabled = not authenticated or phase != "lobby"
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
	animate_models(delta)
	update_krill_camera()
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
