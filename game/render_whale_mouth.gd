extends SceneTree

func _initialize() -> void:
	render_mouth.call_deferred()

func render_mouth() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#092b3e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#cbe5f0")
	env.ambient_light_energy = .7
	world.environment = env
	stage.add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-35,-25,0)
	sun.light_energy = 1.2
	stage.add_child(sun)
	for i in range(3):
		var builder = load("res://krill.gd").new()
		builder.whale = builder.solid_model(builder.models.whale)
		builder.setup_whale_mouth()
		var hinge: Vector3 = builder.jaw.position
		builder.pose_whale_mouth(i*.5)
		assert(builder.jaw.position == hinge,"Jaw hinge must remain fixed")
		builder.whale.position = Vector3((i-1)*22,0,0)
		builder.whale.rotation.y = -.22
		builder.whale.scale = Vector3.ONE*.7
		stage.add_child(builder.whale)
		var label := Label3D.new()
		label.text = ["닫힘","절반 열림","완전히 열림"][i]
		label.font = load("res://fonts/NeoDunggeunmoPro-Regular.ttf")
		label.font_size = 48
		label.pixel_size = .065
		label.position = Vector3((i-1)*22,-10,5)
		stage.add_child(label)
		for unused in [builder.bases,builder.flag,builder.flag_banner,builder.flag_pickup]:
			if is_instance_valid(unused):
				unused.free()
		builder.free()
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 44
	camera.position = Vector3(0,9,65)
	stage.add_child(camera)
	camera.look_at(Vector3(0,-1,0))
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://../.runtime/whale-mouth.png")
	print("PASS: closed, half-open and fully-open jaw retain the same hinge")
	quit()
