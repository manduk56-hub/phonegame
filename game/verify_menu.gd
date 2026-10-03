extends SceneTree

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var hub = load("res://main_menu.tscn").instantiate()
	root.add_child(hub)
	for frame in range(6):
		await process_frame
	assert(hub.menu.visible and hub.cards.size() == 4)
	for card in hub.cards:
		if absf(card.size.x-card.size.y)>1.0:
			push_error("Game cards must be square: %s, viewport: %s" % [card.size,root.size])
			quit(1)
			return
	assert(not hub.play_button.disabled)
	for index in range(1,4):
		hub.cards[index].pressed.emit()
		assert(hub.selected == index and hub.play_button.disabled)
		hub.launch_game()
		assert(not is_instance_valid(hub.active_game))
	hub.cards[0].pressed.emit()
	hub.play_button.pressed.emit()
	await process_frame
	assert(is_instance_valid(hub.active_game))
	assert(not hub.menu.visible and not hub.background.visible)
	var deadline := Time.get_ticks_msec()+6000
	while not hub.active_game.authenticated:
		if Time.get_ticks_msec()>deadline:
			push_error("Menu game did not connect to local test server")
			quit(1)
			return
		await process_frame
	hub.active_game.state.phase = "running"
	await process_frame
	assert(hub.back_button.disabled)
	hub.return_to_menu()
	assert(not hub.menu.visible)
	hub.active_game.state.phase = "lobby"
	await process_frame
	hub.back_button.pressed.emit()
	await process_frame
	assert(hub.menu.visible and hub.background.visible)
	assert(not is_instance_valid(hub.active_game))
	hub.play_button.pressed.emit()
	await process_frame
	assert(is_instance_valid(hub.active_game))
	hub.return_to_menu()
	await process_frame
	print("PASS: game selection, coming-soon lock, arena launch, host connection, running lock, return and relaunch")
	quit()
