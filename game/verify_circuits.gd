extends SceneTree

func _initialize() -> void:
	verify.call_deferred()

func wait_until(predicate: Callable) -> bool:
	for i in range(200):
		if predicate.call():
			return true
		await create_timer(.05).timeout
	return false

func verify() -> void:
	var racing = load("res://racing.tscn").instantiate()
	root.add_child(racing)
	if not await wait_until(func():return racing.authenticated and racing.state.get("game") == "racing"):
		push_error("Racing connection failed")
		quit(1)
		return
	for index in range(racing.circuits.size()):
		var track: Dictionary = racing.circuits[index]
		racing.track_choice.item_selected.emit(index)
		if not await wait_until(func():return racing.state.get("circuit",{}).get("id") == track.id):
			push_error("Circuit selection failed: "+str(track.id))
			quit(1)
			return
		assert(racing.circuit.id == track.id)
		assert(racing.cars.size() == 16)
		assert(racing.track_preview.track.id == track.id)
		assert(not racing.track_choice.disabled)
		await create_timer(.2).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://../.runtime/circuit-"+str(track.id)+".png")
		print("PASS: PC selection, scenery rebuild and 16 cars: ",track.id)
	# Changing during a race must be locked in both the UI and the authority.
	racing.start_button.pressed.emit()
	assert(await wait_until(func():return racing.state.get("phase") == "running"))
	assert(racing.track_choice.disabled)
	racing.track_choice.item_selected.emit(0)
	await create_timer(.2).timeout
	assert(racing.state.circuit.id == racing.circuits[-1].id)
	racing.return_button.pressed.emit()
	assert(await wait_until(func():return racing.state.get("phase") == "lobby"))
	assert(not racing.track_choice.disabled)
	print("PASS: racing track lock and return to circuit selection")
	quit()
