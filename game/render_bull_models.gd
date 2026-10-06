extends SceneTree

func _initialize() -> void:
	render_models.call_deferred()

func render_models() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#263841")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#fff1d9")
	environment.ambient_light_energy = .6
	world.environment = environment
	stage.add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45,-35,0)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	stage.add_child(sun)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 7.6
	camera.position = Vector3(7,4.5,9)
	stage.add_child(camera)
	camera.look_at(Vector3(0,1.1,0))
	var factory = load("res://bull.gd").new()
	var bull: Node3D = factory.solid_model("bull")
	bull.position.x = -1.5
	bull.rotation.y = .35
	stage.add_child(bull)
	var human: Node3D = factory.solid_model("human")
	human.position.x = 2.1
	human.rotation.y = .3
	stage.add_child(human)
	var joints: Dictionary = human.get_meta("joints")
	joints.armL.rotation.x = -.65
	joints.forearmL.rotation.x = -.6
	joints.armR.rotation.x = .5
	joints.forearmR.rotation.x = -.6
	joints.legL.rotation.x = .4
	joints.legR.rotation.x = -.4
	joints.shinL.rotation.x = .55
	for unused in [factory.bases,factory.flag,factory.flag_banner,factory.flag_pickup]:
		unused.free()
	factory.free()
	for frame in range(3):
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://../.runtime/bull-models.png")
	quit()
