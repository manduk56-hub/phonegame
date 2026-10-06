extends SceneTree

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var game = load("res://fishing.tscn").instantiate()
	root.add_child(game)
	game.set_process(false)
	var fixture = JSON.parse_string(FileAccess.get_file_as_string("res://../.runtime/fishing-card-fixture.json"))
	game.accept_state(fixture)
	for child in game.get_children():
		if child is CanvasLayer:
			child.visible = false
	game.camera.size = 23
	game.camera.position = Vector3(15,18,23)
	game.camera.look_at(Vector3(0,1,0))
	for actor in game.actors.values():
		actor.get_node("Marker").hide()
	for frame in range(4):
		await process_frame
	await RenderingServer.frame_post_draw
	var result := root.get_texture().get_image()
	result.save_png("res://assets/fishing-card.png")
	result.save_png("res://../public/assets/fishing-card.png")
	quit()
