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
	var qr_deadline := Time.get_ticks_msec()+6000
	while hub.qr.texture == null or not hub.roster_label.text.contains("1 / 16"):
		if Time.get_ticks_msec()>qr_deadline:
			push_error("Game selection QR or connected roster did not load")
			quit(1)
			return
		await process_frame
	assert(hub.join_label.text.contains("/controller?room="))
	var fixed_qr_position: Vector2 = hub.qr.global_position
	var shared_qr_texture: Texture2D = hub.qr.texture
	assert(shared_qr_texture.get_width() == 1024)
	for index in range(4):
		hub.select_game(index)
		for frame in range(3):
			await process_frame
		assert(hub.qr.global_position == fixed_qr_position)
		assert(hub.qr.texture == shared_qr_texture and hub.qr.is_visible_in_tree())
		assert(hub.qr.get_global_rect().end.y < hub.detail_art.global_position.y)
		assert(hub.play_button.get_global_rect().end.y < hub.size.y, "Play button %s outside menu %s, viewport %s" % [hub.play_button.get_global_rect(),hub.size,root.size])
	for index in range(3,4):
		hub.cards[index].pressed.emit()
		assert(hub.selected == index and not hub.play_button.disabled)
		hub.launch_game()
		assert(is_instance_valid(hub.active_game))
		qr_deadline = Time.get_ticks_msec()+6000
		while hub.active_game.state.get("game") != "bull" or hub.active_game.qr.texture == null:
			if Time.get_ticks_msec()>qr_deadline:
				push_error("Bull menu did not connect")
				quit(1)
				return
			await process_frame
		hub.return_to_menu()
		await process_frame
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
	hub.active_game.send_admin({"type":"start"})
	deadline = Time.get_ticks_msec()+6000
	while hub.active_game.state.get("phase") != "running":
		if Time.get_ticks_msec()>deadline:
			push_error("Test match did not start")
			quit(1)
			return
		await process_frame
	hub._process(0)
	assert(hub.back_button.disabled)
	hub.return_to_menu()
	assert(not hub.menu.visible)
	hub.active_game.send_admin({"type":"lobby"})
	while hub.active_game.state.get("phase") != "lobby":
		await process_frame
	hub._process(0)
	hub.back_button.pressed.emit()
	await process_frame
	assert(hub.menu.visible and hub.background.visible)
	assert(not is_instance_valid(hub.active_game))
	hub.play_button.pressed.emit()
	await process_frame
	assert(is_instance_valid(hub.active_game))
	hub.return_to_menu()
	await process_frame
	hub.select_game(1)
	assert(not hub.play_button.disabled)
	hub.launch_game()
	deadline = Time.get_ticks_msec()+6000
	while hub.active_game.state.get("game") != "racing" or hub.active_game.qr.texture == null:
		if Time.get_ticks_msec()>deadline:
			push_error("Racing menu did not select the server game")
			quit(1)
			return
		await process_frame
	assert(hub.active_game.qr.texture != null)
	hub.return_to_menu()
	await process_frame
	hub.select_game(2)
	assert(not hub.play_button.disabled)
	hub.launch_game()
	deadline = Time.get_ticks_msec()+6000
	while hub.active_game.state.get("game") != "fps" or hub.active_game.qr.texture == null:
		if Time.get_ticks_msec()>deadline:
			push_error("FPS menu did not select the server game")
			quit(1)
			return
		await process_frame
	assert(hub.active_game.camera.position == Vector3(34,40,42))
	assert(hub.active_game.state.fps.arena.walls.size() == hub.active_game.arena.walls.size())
	assert(hub.active_game.camera.size == hub.active_game.arena.overviewSize)
	hub.active_game.send_admin({"type":"start"})
	deadline = Time.get_ticks_msec()+6000
	while hub.active_game.state.get("phase") != "running":
		if Time.get_ticks_msec()>deadline:
			push_error("FPS did not start")
			quit(1)
			return
		await process_frame
	hub.active_game.send_admin({"type":"lobby"})
	while hub.active_game.state.get("phase") != "lobby":
		await process_frame
	hub.return_to_menu()
	await process_frame
	print("PASS: selection QR and roster, all four playable games, bull selection, host connection, running lock and return")
	quit()
