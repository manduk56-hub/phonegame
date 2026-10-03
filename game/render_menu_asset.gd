extends "res://main.gd"

# Render the exact gameplay model, including its hydraulic parts and paint shader.
func _ready() -> void:
	machine_material.shader = load("res://voxel.gdshader")
	var viewport := SubViewport.new()
	viewport.size = Vector2i(1024,1024)
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.msaa_3d = Viewport.MSAA_4X
	add_child(viewport)
	var stage := Node3D.new()
	viewport.add_child(stage)
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#b7ba8b")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#fff0cf")
	environment.ambient_light_energy = 0.35
	world.environment = environment
	stage.add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48,-35,0)
	sun.light_energy = 0.55
	sun.shadow_enabled = true
	stage.add_child(sun)
	box(stage,Vector3(200,0.2,200),Vector3(0,-0.13,0),Color("#b7ba8b"))
	box(stage,Vector3(4.8,0.12,5.4),Vector3(0,-0.01,0.9),Color("#d7c79c"))
	for x in [-2.2,2.2]:
		for z in range(-1,4):
			box(stage,Vector3(0.12,0.025,0.42),Vector3(x,0.063,z),Color("#f3e3ba"))
	var sand := pile(0.8,Color("#d5ae72"))
	sand.position = Vector3(1.6,0.05,1.7)
	stage.add_child(sand)
	var model := excavator({"team":0,"name":""},0)
	model.root.reparent(stage)
	model.root.rotation.y = -0.15
	model.upper.rotation.y = 0.3
	model.boom.rotation.x = -0.95
	model.stick.rotation.x = 1.5
	model.bucket.rotation.x = 0.9-PI/2
	model.marker.hide()
	model.number.hide()
	model.dirt.show()
	update_ram(model.boom_ram,Vector3(0,0.05,0.35),model.upper.to_local(model.boom.to_global(Vector3(0,0.18,1.55))))
	update_ram(model.stick_ram,Vector3(0,0.43,0.65),model.boom.to_local(model.stick.to_global(Vector3(0,0.3,0.7))))
	update_ram(model.bucket_ram,Vector3(0,0.25,0.5),model.stick.to_local(model.bucket.to_global(Vector3(0,0.3,-0.15))))
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 6.5
	camera.position = Vector3(-6,4.8,7)
	stage.add_child(camera)
	camera.look_at(Vector3(0,1.4,0.9))
	for frame in range(4):
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
	var picture := viewport.get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://assets"))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://../public/assets"))
	assert(picture.save_png("res://assets/dirt-rally-card.png") == OK)
	assert(picture.save_png("res://../public/assets/dirt-rally-card.png") == OK)
	print("PASS: rendered the gameplay excavator pose at 1024 x 1024")
	get_tree().quit()

func _process(_delta: float) -> void:
	pass
