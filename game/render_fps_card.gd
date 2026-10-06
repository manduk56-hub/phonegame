extends SceneTree

# Promotional still built from the same soldier, rifle, flag and arena models as FPS.
func _initialize() -> void:
	render_card.call_deferred()

func action_parts(parts: Array, stride: float) -> Array:
	var posed: Array = parts.duplicate(true)
	for index in range(posed.size()):
		var part: Dictionary = posed[index]
		var pivot := Vector3.ZERO
		var angle := 0.0
		if index in [4,5,6,7]:
			pivot = Vector3(-.16,.82,0)
			angle = stride
		elif index in [11,12,13,14]:
			pivot = Vector3(.16,.82,0)
			angle = -stride
		elif index in [8,9,10,15,16,17]:
			pivot = Vector3(part.pos[0],1.36,0)
			angle = -1.0
		else:
			continue
		var point := Vector3(part.pos[0],part.pos[1],part.pos[2])
		point = pivot + Basis(Vector3.RIGHT,angle)*(point-pivot)
		part.pos = [point.x,point.y,point.z]
		part.rot[0] += angle
	return posed

func beam(factory, parent: Node3D, from: Vector3, to: Vector3) -> void:
	var ray: Vector3 = to-from
	var streak: MeshInstance3D = factory.bright_block(parent,Vector3(.035,ray.length(),.035),(from+to)*.5,Color("#ffec95"))
	streak.quaternion = Quaternion(Vector3.UP,ray.normalized())
	for index in range(3):
		var size := Vector3(.65,.09,.09)
		if index == 1:
			size = Vector3(.09,.65,.09)
		elif index == 2:
			size = Vector3(.22,.22,.4)
		var flash: MeshInstance3D = factory.bright_block(parent,size,from,Color("#fff4bb") if index == 2 else Color("#ffac25"))
		flash.rotation.z = .4

func render_card() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(1920,1080)
	viewport.msaa_3d = Viewport.MSAA_4X
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	var stage := Node3D.new()
	viewport.add_child(stage)
	var factory = load("res://fps.gd").new()
	factory.prepare_art()
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#6f9fae")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#e6f6ff")
	environment.ambient_light_energy = .4
	world.environment = environment
	stage.add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-32,-38,0)
	sun.light_color = Color("#ffefcc")
	sun.light_energy = .7
	sun.shadow_enabled = true
	stage.add_child(sun)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_PERSPECTIVE
	camera.fov = 44
	camera.position = Vector3(5,3.8,11)
	stage.add_child(camera)
	camera.look_at(Vector3(0,1.8,-1))
	camera.rotation.z = -.07
	camera.current = true
	var floor_mesh: MeshInstance3D = factory.block(stage,Vector3(300,.2,300),Vector3(0,-.1,0),Color.WHITE)
	var floor_material: StandardMaterial3D = factory.art_materials.ground.duplicate()
	floor_material.uv1_scale = Vector3(32,32,1)
	floor_material.albedo_color = Color("#c9af86")
	floor_mesh.material_override = floor_material
	# Keep the existing arena behind the foreground action for clear card cropping.
	var backdrop: Array = factory.art.world.filter(func(part): return part.pos[2] < -8)
	stage.add_child(factory.art_model(backdrop))
	var muzzles: Array[Vector3] = []
	for pose in [[-3.4,2.3,1.15,"#2866ce",.65],[3.5,.8,-1.1,"#d84238",-.55],[0,-2.8,.3,"#2866ce",.8],[4.0,-6.0,-.8,"#d84238",.45]]:
		var soldier := Node3D.new()
		stage.add_child(soldier)
		soldier.position = Vector3(pose[0],0,pose[1])
		soldier.rotation.y = pose[2]
		soldier.scale = Vector3.ONE*1.7
		soldier.rotation.x = -.12
		soldier.position.y = .2
		soldier.add_child(factory.art_model(action_parts(factory.art.actor,pose[4]),Color(pose[3])))
		var rifle: Node3D = factory.art_model(factory.art.rifle)
		rifle.scale = Vector3.ONE*.6
		rifle.position = Vector3(.03,1.2,.42)
		soldier.add_child(rifle)
		muzzles.append(soldier.to_global(Vector3(.03,1.2,.94)))
	beam(factory,stage,muzzles[0],Vector3(3,1.5,-.2))
	beam(factory,stage,muzzles[1],Vector3(-4,1.6,-1.1))
	beam(factory,stage,muzzles[3],Vector3(-1,1.7,-3))
	# Small angular dust clouds trail the runners and mark bullet impacts.
	var rng := RandomNumberGenerator.new()
	rng.seed = 94
	for point in [Vector3(-4,0,3.8),Vector3(3.8,0,2.8),Vector3(0,0,-4.3),Vector3(-4,0,-1.1)]:
		for index in range(8):
			var puff := MeshInstance3D.new()
			var sphere := SphereMesh.new()
			sphere.radial_segments = 7
			sphere.rings = 3
			sphere.radius = rng.randf_range(.18,.5)
			sphere.height = sphere.radius*1.5
			puff.mesh = sphere
			var material := StandardMaterial3D.new()
			material.albedo_color = Color("#d4bd96")
			material.roughness = 1
			puff.material_override = material
			stage.add_child(puff)
			puff.position = point+Vector3(rng.randf_range(-.65,.65),rng.randf_range(.1,.45),rng.randf_range(-.5,.5))
	stage.add_child(factory.flag)
	factory.build_flag()
	factory.remove_child(factory.flag_pickup)
	stage.add_child(factory.flag_pickup)
	factory.flag_label.visible = false
	factory.flag.position = Vector3(.3,1.2,-3)
	factory.flag.scale = Vector3.ONE*.85
	factory.flag.rotation.y = .45
	factory.flag.get_node("Pedestal").visible = false
	factory.flag_pickup.position = Vector3(0,0,-2.8)
	factory.flag_pickup.visible = false
	factory.flag_pickup.scale = Vector3(2.5,1,2.5)
	for frame in range(8):
		await process_frame
	await RenderingServer.frame_post_draw
	var image := viewport.get_texture().get_image()
	var result := image.save_png("res://assets/fps-model-card.png")
	print("FPS model card: 1920x1080, save result ",result)
	factory.bases.free()
	factory.free()
	quit(result)
