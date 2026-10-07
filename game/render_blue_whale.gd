extends SceneTree

func _initialize() -> void:
	render_whale.call_deferred()

func render_whale() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#092b3e")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#cbe5f0")
	env.ambient_light_energy = .65
	world.environment = env
	stage.add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-35,-25,0)
	sun.light_energy = 1.15
	stage.add_child(sun)
	var builder = load("res://krill.gd").new()
	builder.whale = builder.solid_model(builder.models.whale)
	builder.setup_whale_mouth()
	stage.add_child(builder.whale)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 31
	camera.position = Vector3(-42,26,35)
	stage.add_child(camera)
	camera.look_at(Vector3(0,0,-12))
	var label := Label3D.new()
	label.text = "BLUE WHALE / 흰수염고래"
	label.font = load("res://fonts/NeoDunggeunmoPro-Regular.ttf")
	label.font_size = 48
	label.pixel_size = .035
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = Vector3(0,-11,-10)
	stage.add_child(label)
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://../.runtime/blue-whale.png")
	for unused in [builder.bases,builder.flag,builder.flag_banner,builder.flag_pickup]:
		if is_instance_valid(unused):
			unused.free()
	builder.free()
	quit()
