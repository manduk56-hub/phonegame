extends SceneTree

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var game = load("res://fishing.tscn").instantiate()
	root.add_child(game)
	game.set_process(false)
	game.boat.hide()
	for child in game.get_children():
		if child is CanvasLayer:
			child.visible = false
	game.camera.size = 15.5
	game.camera.position = Vector3(0,15,22)
	game.camera.look_at(Vector3(0,1,0))
	var index := 0
	for species in game.meshes.species:
		var pos := Vector3((index%4-1.5)*6.1,1.4,(index/4-.5)*7.6)
		var fish: Node3D = game.fishing_model(game.meshes.fishModels[species.id])
		fish.position = pos
		fish.scale = Vector3.ONE*1.12
		fish.rotation.y = -PI/2
		game.add_child(fish)
		var marker := Label3D.new()
		marker.font = game.FONT
		marker.text = "%02d · %s" % [index+1,species.name]
		marker.font_size = 46
		marker.pixel_size = .016
		marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		marker.position = pos+Vector3(0,-1.2,2.0)
		game.add_child(marker)
		index += 1
	for frame in range(4):
		await process_frame
	await RenderingServer.frame_post_draw
	var result := root.get_texture().get_image()
	result.save_png("res://../.runtime/fishing-fish-models.png")
	result.save_png("res://../public/assets/fishing-fish-models.png")
	quit()
