extends SceneTree

func _initialize() -> void:
	run.call_deferred()

func verify_preparation(hub: Node, name: String) -> void:
	var game: Node = hub.active_game
	await process_frame
	await process_frame
	assert(game.lobby.size.x == 960 and game.lobby.size.y == 616, "%s preparation size: %s" % [name,game.lobby.size])
	assert(game.start_button.get_global_rect().end.y <= game.lobby.get_global_rect().end.y)
	assert(game.qr.get_global_rect().position.x > game.lobby.get_global_rect().end.x)
	game.lobby.hide()
	assert(not game.qr.is_visible_in_tree())
	game.lobby.show()
	assert(game.qr.is_visible_in_tree())
	if OS.get_environment("PLAYROOM_UI_CAPTURE") == "1":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://../.runtime/preparation-%s.png" % name)

func run() -> void:
	var hub = load("res://main_menu.tscn").instantiate()
	root.add_child(hub)
	for frame in range(6):
		await process_frame
	assert(hub.menu.visible and hub.cards.size() == hub.GAMES.size() and hub.cards.size() >= 5)
	for card in hub.cards:
		if absf(card.size.x-card.size.y)>1.0:
			push_error("Game cards must be square: %s, viewport: %s" % [card.size,root.size])
			quit(1)
			return
	assert(not hub.play_button.disabled)
	assert(hub.quit_button.text.contains("Esc") and hub.quit_button.pressed.is_connected(hub.quit_game))
	assert(hub.quit_button.get_global_rect().end.y <= hub.size.y)
	var qr_deadline := Time.get_ticks_msec()+6000
	while hub.qr.texture == null or not hub.roster_label.text.contains("1 / 16"):
		if Time.get_ticks_msec()>qr_deadline:
			push_error("Game selection QR or connected roster did not load")
			quit(1)
			return
		await process_frame
	assert(hub.join_label.text.contains("/controller?room="))
	if OS.get_environment("PLAYROOM_UI_CAPTURE") == "1":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://../.runtime/selection-ui.png")
	var fixed_qr_position: Vector2 = hub.qr.global_position
	var shared_qr_texture: Texture2D = hub.qr.texture
	assert(shared_qr_texture.get_width() == 1024)
	for index in range(6):
		hub.select_game(index)
		for frame in range(3):
			await process_frame
		assert(hub.qr.global_position == fixed_qr_position)
		assert(hub.qr.texture == shared_qr_texture and hub.qr.is_visible_in_tree())
		assert(hub.qr.get_global_rect().end.y < hub.detail_art.global_position.y)
		assert(hub.play_button.get_global_rect().end.y < hub.size.y, "Play button %s outside menu %s, viewport %s" % [hub.play_button.get_global_rect(),hub.size,root.size])
	for index in range(3,6):
		hub.cards[index].pressed.emit()
		assert(hub.selected == index and not hub.play_button.disabled)
		hub.launch_game()
		assert(is_instance_valid(hub.active_game))
		qr_deadline = Time.get_ticks_msec()+6000
		while hub.active_game.state.get("game") != (["bull","fishing","krill"][index-3]) or hub.active_game.qr.texture == null:
			if Time.get_ticks_msec()>qr_deadline:
				push_error("Selected menu did not connect")
				quit(1)
				return
			await process_frame
		await verify_preparation(hub,["bull","fishing","krill"][index-3])
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
	await verify_preparation(hub,"racing")
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
	await verify_preparation(hub,"fps")
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
	print("PASS: selection exit button and Escape, shared preparation layout and QR visibility, all six playable games, host connection, running lock and return")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	hub._input(escape)
