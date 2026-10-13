extends SceneTree

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var game = load("res://krill.tscn").instantiate()
	root.add_child(game)
	game.set_process(false)
	for child in game.get_children():
		if child is CanvasLayer:
			child.visible = false
	game.danger_zone.hide()
	game.water_vortex.hide()
	game.whale.position = Vector3(-3,2,-10)
	game.whale.scale = Vector3.ONE*1.2
	game.whale.rotation.y = .15
	game.pose_whale_mouth(.85)
	for entry in [[Vector3(5,-2,8),6.0,.25],[Vector3(8,2,9),3.0,-.25],[Vector3(-1,-4,10),3.5,.1]]:
		var actor: Node3D = game.solid_model(game.models.krill)
		actor.position = entry[0]
		actor.scale = Vector3.ONE*entry[1]
		actor.rotation.y = entry[2]
		game.add_child(actor)
	game.camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	game.camera.size = 27
	game.camera.position = Vector3(0,3,32)
	game.camera.look_at(Vector3(0,0,-3))
	for frame in range(4):
		await process_frame
	await RenderingServer.frame_post_draw
	var result := root.get_texture().get_image()
	result.save_png("res://assets/krill-card.png")
	result.save_png("res://../public/assets/krill-card.png")
	quit()
