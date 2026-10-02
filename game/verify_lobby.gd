extends SceneTree

var game: Node

func _initialize() -> void:
	run.call_deferred()

func check(condition: bool, message: String) -> bool:
	if not condition:
		push_error(message)
		quit(1)
	return condition

func wait_until(predicate: Callable) -> bool:
	var deadline := Time.get_ticks_msec()+6000
	while not predicate.call():
		if Time.get_ticks_msec() > deadline:
			print("Timeout phase: ",game.state.get("phase")," teams: ",game.state.get("teamCount")," duration: ",game.state.get("duration")," authenticated: ",game.authenticated," message: ",game.lobby_message.text)
			return check(false,"Lobby verification timed out")
		await process_frame
	return true

func run() -> void:
	game = load("res://main.tscn").instantiate()
	root.add_child(game)
	if not await wait_until(func():return game.authenticated and game.state.get("players",[]).size() == 16):
		return
	if not check(game.lobby_panel.visible and not game.start_button.disabled,"Lobby must open with enabled host controls"):
		return
	if not await wait_until(func():return game.chat_log.get_parsed_text().contains("모바일 채팅 연동 확인 <b>그대로 표시</b>")):
		return
	print("VERIFY_CHAT")
	game.team_select.select(7)
	game.duration_input.get_line_edit().text = "60"
	game.configure_button.pressed.emit()
	print("VERIFY_CONFIGURE")
	if not await wait_until(func():return game.state.teamCount == 8 and game.state.duration == 60):
		return
	var id: String = game.state.players[0].id
	game.player_controls[0].item_selected.emit(7)
	print("VERIFY_ASSIGN")
	if not await wait_until(func():return game.state.players[0].team == 7):
		return
	if not check(game.machines[id].paint_material.get_shader_parameter("team_color") == Color(game.COLORS[7]),"Assigned team must recolor the excavator"):
		return
	game.player_controls[-1].pressed.emit()
	print("VERIFY_REMOVE")
	if not await wait_until(func():return game.state.players.size() == 15):
		return
	game.network_select.item_selected.emit(0)
	if not await wait_until(func():return game.qr.texture != null):
		return
	if not check(game.qr.visible and game.join_label.visible,"Open lobby must show QR and join address"):
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://../.runtime/lobby-preview.png")
	game.start_button.pressed.emit()
	print("VERIFY_START")
	if not await wait_until(func():return game.state.phase == "running"):
		return
	if not check(not game.lobby_panel.visible and game.configure_button.disabled and game.player_controls[0].disabled,"Running match must hide panel and lock roster"):
		return
	if not check(not game.qr.visible and not game.join_label.visible,"Starting match must hide QR and join address"):
		return
	game.lobby_panel.show()
	if not check(game.qr.visible and game.join_label.visible,"Reopening team settings during match must show QR"):
		return
	game.lobby_panel.hide()
	if not check(not game.qr.visible and not game.join_label.visible,"Closing team settings must hide QR"):
		return
	game.lobby_panel.show()
	game.return_button.pressed.emit()
	if not check(game.reset_dialog.visible,"Returning during a match must show reset confirmation"):
		return
	game.reset_dialog.confirmed.emit()
	if not await wait_until(func():return game.state.phase == "lobby"):
		return
	if not check(game.state.players.size() == 15 and game.state.players[0].team == 7,"Return must retain players and team assignments"):
		return
	game.socket.close()
	if not await wait_until(func():return not game.authenticated):
		return
	if not check(game.start_button.disabled and game.player_controls[0].disabled,"Disconnected management must be locked"):
		return
	if not await wait_until(func():return game.authenticated):
		return
	game.start_button.pressed.emit()
	if not await wait_until(func():return game.state.phase == "running"):
		return
	print("VERIFY_FINISH")
	if not await wait_until(func():return game.state.phase == "finished"):
		return
	if not check(game.lobby_panel.visible and not game.return_button.disabled,"Finished match must show lobby return"):
		return
	if not check(game.qr.visible and game.join_label.visible,"Finished match lobby must show QR"):
		return
	game.return_button.pressed.emit()
	if not await wait_until(func():return game.state.phase == "lobby"):
		return
	print("PASS: native lobby configure, assign, recolor, remove, QR, start, reset, reconnect, finish and return")
	quit()
