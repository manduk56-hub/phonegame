extends SceneTree

# Use the playable NPC model, like the fishing and krill menu covers.
func _initialize() -> void:
	run.call_deferred()

func commuter(game: Node3D, position: Vector3, yaw: float, stride: float) -> Node3D:
	var actor: Node3D = game.make_person({"id":"station", "coat":"#466478"})
	actor.position = position
	actor.rotation.y = yaw
	actor.scale = Vector3.ONE * 1.8
	actor.get_node("LegL").rotation.x = stride
	actor.get_node("LegR").rotation.x = -stride
	actor.get_node("ArmL").rotation.x = -stride * .8
	actor.get_node("ArmR").rotation.x = stride * .8
	return actor

func run() -> void:
	var game = load("res://disguise.tscn").instantiate()
	root.add_child(game)
	game.set_process(false)
	root.msaa_3d = Viewport.MSAA_4X
	for child in game.get_children():
		if child is CanvasLayer:
			child.visible = false
		elif child is DirectionalLight3D:
			child.shadow_enabled = true
			child.light_energy = .55
			child.light_color = Color("#ffe4bc")
			child.rotation_degrees = Vector3(-48,-35,0)
		elif child is WorldEnvironment:
			child.environment.ambient_light_energy = .22
			child.environment.ambient_light_color = Color("#a7c2d0")
			child.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
			child.environment.background_color = Color("#354e5c")
	var stage := Node3D.new()
	game.add_child(stage)
	game.block(stage,Vector3(50,14,.4),Vector3(0,5,-9),Color("#354e5c"))
	for x in range(-24,25,5):
		game.block(stage,Vector3(3.5,.12,.2),Vector3(x,5,-8.7),Color("#fff0c1"))
	game.block(stage,Vector3(50,.2,40),Vector3(0,-.15,0),Color("#aabebf"))
	# Tiled concourse, warm platform edge, and a passing block-built train.
	for x in range(-24,25,2):
		game.block(stage,Vector3(.025,.012,40),Vector3(x,-.04,0),Color("#8da6ad"))
	for z in range(-18,19,2):
		game.block(stage,Vector3(50,.012,.025),Vector3(0,-.04,z),Color("#8da6ad"))
	game.block(stage,Vector3(50,.04,.65),Vector3(0,.01,-4),Color("#e5bd60"))
	game.block(stage,Vector3(50,.05,.12),Vector3(0,.02,-3.45),Color("#fff0b2"))
	game.block(stage,Vector3(50,.25,4),Vector3(0,-.28,-7),Color("#354754"))
	game.block(stage,Vector3(42,3.5,2.5),Vector3(0,1.7,-7),Color("#d8e4dd"))
	game.block(stage,Vector3(42,.42,2.56),Vector3(0,.75,-7),Color("#438787"))
	for x in range(-20,21,3):
		game.block(stage,Vector3(1.9,1.05,.08),Vector3(x,2.2,-5.7),Color("#527384"))
		game.block(stage,Vector3(.1,3,.1),Vector3(x+1.25,1.6,-5.69),Color("#a4b9b6"))
	# Crowd members share the same clothes and silhouette as the two focal NPCs.
	for entry in [
		[-8,0, .5],[-5.5,-1, -.9],[-3,-1.6, .2],[0,-2.2, 2.5],
		[2.8,-1.2, -.4],[5.2,-2.1, 1.8],[7.5,-.6, -.3],
		[-8,4, 1.3],[-5,3, -.4],[6,3, -1.6],[8,4.5, .3],
		[-9,-3, 2.3],[9,-2.8, 2.8]]:
		commuter(game,Vector3(entry[0],0,entry[1]),entry[2],sin(entry[0]*2.7)*.48)
	var pursuer := commuter(game,Vector3(-1.7,0,4),.35,.65)
	pursuer.rotation.z = -.13
	pursuer.get_node("ArmR").rotation.x = -1.65
	pursuer.get_node("ArmR").rotation.z = -.7
	pursuer.get_node("ArmL").rotation.x = -.4
	var evader := commuter(game,Vector3(1.7,.16,4.5),-.45,-.75)
	evader.rotation.z = -.19
	evader.get_node("ArmL").rotation.z = -.7
	evader.get_node("ArmR").rotation.x = -.9
	# A bench anchors the platform without competing with the foreground action.
	game.block(stage,Vector3(3.3,.2,.9),Vector3(-7,.8,1),Color("#927b56"))
	for x in [-8.2,-5.8]:
		game.block(stage,Vector3(.16,.8,.65),Vector3(x,.35,1),Color("#4e6566"))
	game.camera.projection = Camera3D.PROJECTION_PERSPECTIVE
	game.camera.fov = 42
	game.camera.position = Vector3(4,6.5,14)
	game.camera.look_at(Vector3(0,1.5,2))
	for frame in range(6):
		await process_frame
	await RenderingServer.frame_post_draw
	var result := root.get_texture().get_image()
	result.save_png("res://assets/disguise-card.png")
	result.save_png("res://../public/assets/disguise-card.png")
	quit()
