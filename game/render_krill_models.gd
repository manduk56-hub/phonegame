extends SceneTree

func _initialize() -> void:
	render_models.call_deferred()

func render_models() -> void:
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
	var builder = load("res://krill.gd").new()
	var whale: Node3D = builder.solid_model(builder.models.whale)
	whale.position = Vector3(-11,1,0)
	whale.rotation.y = -.2
	stage.add_child(whale)
	var krill: Node3D = builder.solid_model(builder.models.krill)
	krill.position = Vector3(14,1,3)
	krill.scale = Vector3.ONE*8
	krill.rotation.y = 0
	stage.add_child(krill)
	for entry in [["WHALE / 고래",Vector3(-11,-10,3)],["KRILL / 크릴",Vector3(14,-10,3)]]:
		var label := Label3D.new()
		label.text = entry[0]
		label.font = load("res://fonts/NeoDunggeunmoPro-Regular.ttf")
		label.font_size = 56
		label.pixel_size = .07
		label.position = entry[1]
		stage.add_child(label)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 58
	camera.position = Vector3(0,8,58)
	stage.add_child(camera)
	camera.look_at(Vector3(0,0,0))
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://../.runtime/krill-models.png")
	for unused in [builder.bases,builder.flag,builder.flag_banner,builder.flag_pickup]:
		if is_instance_valid(unused):
			unused.free()
	builder.free()
	quit()
