extends SceneTree

# Match the existing model-rendered menu art; never bake labels or UI into covers.
func _initialize() -> void:
	run.call_deferred()

func capture(name: String) -> void:
	for frame in range(6):
		await process_frame
	await RenderingServer.frame_post_draw
	var result := root.get_texture().get_image()
	assert(result.save_png("res://assets/%s-card.png" % name) == OK)
	assert(result.save_png("res://../public/assets/%s-card.png" % name) == OK)

func run() -> void:
	root.msaa_3d = Viewport.MSAA_4X
	var game = load("res://clover.tscn").instantiate()
	root.add_child(game)
	game.set_process(false)
	game.fixture = true
	for child in game.get_children():
		if child is CanvasLayer:
			child.hide()
		elif child is DirectionalLight3D:
			child.shadow_enabled = true
			child.rotation_degrees = Vector3(-55,-30,0)
			child.light_energy = .8
		elif child is WorldEnvironment:
			child.environment.ambient_light_energy = .55
	# Use the playable field, leaves, and player construction through accept_state.
	var plants: Array = []
	for z in range(-5,6):
		for x in range(-7,8):
			plants.append({"id":plants.size(),"x":x*.9,"z":z*.85,"angle":.35+((x+z)%3)*.3})
	var players: Array = []
	var positions := [Vector2(-2.0,1.7),Vector2(1.7,.8),Vector2(-1.4,-2.3),Vector2(3.5,-2.2)]
	var colors := ["#e87762","#6b9bbb","#e4bf60","#a697c2"]
	for i in range(4):
		players.append({"id":str(i),"name":"","number":i+1,"color":colors[i],"x":positions[i].x,"z":positions[i].y,"clovers":0,"crouching":false,"connected":true})
	game.accept_state({"game":"clover","phase":"running","remaining":180,"players":players,"clover":{"round":1,"plants":plants,"target":97,"reset":0}})
	for actor in game.actors.values():
		for child in actor.get_children():
			if child is Label3D:
				child.hide()
	# Pose the same block characters mid-reach and mid-stride for cover art.
	for i in range(4):
		var actor: Node3D = game.actors[str(i)]
		actor.scale = Vector3.ONE*1.45
		actor.rotation_degrees = Vector3(-8, -20 if i==0 else 25, -17 if i==0 else 16)
		for side in [-1.0,1.0]:
			var arm = game.block(actor,Vector3(.18,.62,.2),Vector3(side*.37,.87,.06),Color(colors[i]))
			arm.rotation_degrees.x = -65 if i==0 else side*48
			arm.rotation_degrees.z = side*(-35 if i==0 else 18)
			var leg = game.block(actor,Vector3(.18,.45,.23),Vector3(side*.14,.22,side*.14),Color("#354c58"))
			leg.rotation_degrees.x = side*32
		# Tiny dark eyes preserve the simple block-model language of other covers.
		for side in [-1.0,1.0]:
			game.block(actor,Vector3(.055,.065,.025),Vector3(side*.095,1.27,.2),Color("#263331"))
	# A close four-leaf cluster uses the same leaf mesh and material as the field.
	var focal := Node3D.new()
	game.add_child(focal)
	focal.position = Vector3(-.45,1.45,1.8)
	focal.scale = Vector3.ONE*1.9
	focal.rotation_degrees = Vector3(32,0,-18)
	for j in range(4):
		var a := j*TAU/4+.35
		game.leaf(focal,Vector3(sin(a)*.23,.1,cos(a)*.23),a)
	game.block(focal,Vector3(.035,.45,.035),Vector3(0,-.14,0),Color("#2e7340"))
	for i in range(7):
		var dirt = game.block(game,Vector3.ONE*(.09+(i%3)*.035),Vector3(-.35+sin(i*2.4)*.65,.35+(i%3)*.22,1.9+cos(i*2.4)*.5),Color("#93714e"))
		dirt.rotation_degrees = Vector3(i*23,i*35,i*17)
	game.camera.projection = Camera3D.PROJECTION_PERSPECTIVE
	game.camera.fov = 47
	game.camera.position = Vector3(2.4,3.6,7.2)
	game.camera.look_at(Vector3(0,.85,.5))
	game.camera.rotate_object_local(Vector3.FORWARD,deg_to_rad(-6))
	await capture("clover")
	# The mole game has a 2D actor. Translate its brown/pink silhouette into the
	# same hard-edged block language as the other games, preserving the 3x3 board.
	for child in game.get_children():
		if child is Node3D and not child is Camera3D and not child is DirectionalLight3D and not child is WorldEnvironment:
			child.queue_free()
	await process_frame
	var stage := Node3D.new()
	game.add_child(stage)
	game.block(stage,Vector3(11,.6,9),Vector3(0,-.4,0),Color("#8b7047"))
	game.block(stage,Vector3(11,.12,9),Vector3(0,-.04,0),Color("#758849"))
	for z in [-2.8,0.0,2.8]:
		for x in [-3.3,0.0,3.3]:
			game.block(stage,Vector3(2.1,.04,1.8),Vector3(x,.04,z),Color("#271d1b"))
			for edge in [-1.0,1.0]:
				game.block(stage,Vector3(2.5,.15,.25),Vector3(x,.1,z+edge*.96),Color("#b59556"))
				game.block(stage,Vector3(.25,.15,1.7),Vector3(x+edge*1.13,.1,z),Color("#b59556"))
	var mole := Node3D.new()
	stage.add_child(mole)
	mole.position = Vector3(-.3,.15,.15)
	mole.scale = Vector3.ONE*1.35
	mole.rotation_degrees = Vector3(-8,-12,-16)
	game.block(mole,Vector3(1.5,1.4,1.3),Vector3(0,.8,0),Color("#bd855b"))
	game.block(mole,Vector3(1.2,.35,1.1),Vector3(0,1.65,0),Color("#bd855b"))
	for side in [-1.0,1.0]:
		game.block(mole,Vector3(.3,.35,.28),Vector3(side*.74,1.47,0),Color("#a66f4e"))
		game.block(mole,Vector3(.16,.18,.08),Vector3(side*.36,1.32,.68),Color("#271d1b"))
		game.block(mole,Vector3(.42,.23,.4),Vector3(side*.63,.3,.87),Color("#efb093"))
	game.block(mole,Vector3(.67,.42,.25),Vector3(0,.92,.76),Color("#efb093"))
	game.block(mole,Vector3(.24,.16,.1),Vector3(0,1.04,.92),Color("#75433c"))
	# Block-built mallet, matching the simple model treatment in BULL RUN.
	var mallet := Node3D.new()
	stage.add_child(mallet)
	mallet.position = Vector3(2,3.6,.3)
	mallet.scale = Vector3.ONE*1.45
	mallet.rotation_degrees = Vector3(12,-18,-57)
	game.block(mallet,Vector3(.24,2.1,.24),Vector3(0,.7,0),Color("#967349"))
	game.block(mallet,Vector3(1.6,.72,.8),Vector3(0,-.5,0),Color("#c7a36d"))
	for side in [-1.0,1.0]:
		game.block(mallet,Vector3(.17,.8,.88),Vector3(side*.76,-.5,0),Color("#ad6952"))
	# Dislodged blocky earth freezes the instant the mole bursts from its hole.
	for i in range(10):
		var a := i*2.4
		var dirt = game.block(stage,Vector3.ONE*(.12+(i%3)*.045),Vector3(-.3+sin(a)*1.65,.5+(i%4)*.37,.15+cos(a)*1.2),Color("#967349"))
		dirt.rotation_degrees = Vector3(i*21,i*32,i*13)
	game.camera.fov = 52
	game.camera.position = Vector3(3.6,4.1,7.4)
	game.camera.look_at(Vector3(.2,1.25,.1))
	game.camera.rotate_object_local(Vector3.FORWARD,deg_to_rad(7))
	await capture("mole")
	quit()
