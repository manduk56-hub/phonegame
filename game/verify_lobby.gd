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
	if not check(game.result_panel.visible and not game.result_return.disabled and not game.lobby_panel.visible,"Finished match must show results and return action"):
		return
	if not check(game.result_title.text == "이번 경기는 무승부","Zero-score finish must show a draw"):
		return
	game.result_return.pressed.emit()
	if not await wait_until(func():return game.state.phase == "lobby"):
		return
	game.start_button.pressed.emit()
	if not await wait_until(func():return game.state.phase == "running"):
		return
	print("VERIFY_WINNING")
	if not await wait_until(func():return game.state.phase == "finished"):
		return
	if not check(game.result_title.text == "팀 8 우승!" and game.arena_visuals.all(func(visual):return visual is Label3D or visual == game.center_pile or visual.visible),"Winning finish must show team title and the actual arena"):
		return
	if not check(game.result_backdrop.visible and game.match_environment.background_mode == Environment.BG_SKY and game.team_nodes.all(func(team):return not team.root.visible),"Result scene must fill the background and hide team zones"):
		return
	var winner: Dictionary = game.state.players[0]
	var machine: Dictionary = game.machines[winner.id]
	if not check(game.camera.position.z > float(winner.z) and float(winner.yaw) == 0.0,"Camera must face the front of the winning excavator"):
		return
	var original_results := JSON.stringify(game.state.results)
	print("VERIFY_CEREMONY")
	if not await wait_until(func():return absf(machine.upper.rotation.y) > 0.1 and absf(machine.boom.rotation.x+0.75) > 0.03):
		return
	if not check(JSON.stringify(game.state.results) == original_results and game.state.remaining == 0,"Ceremony input must preserve final scores and timer"):
		return
	for p in game.state.players:
		if not check(game.machines[p.id].root.visible == (int(p.team) == 7),"Only winner machines must appear on stage"):
			return
	game.result_return.pressed.emit()
	if not await wait_until(func():return game.state.phase == "lobby"):
		return
	if not check(not game.ceremony_stage.visible and not game.result_backdrop.visible and game.camera.h_offset == 0.0 and game.camera.projection == Camera3D.PROJECTION_ORTHOGONAL and game.match_environment.background_mode == Environment.BG_COLOR,"Next match must restore the arena camera and background"):
		return
	print("PASS: native lobby configure, assign, recolor, remove, QR, start, reset, reconnect, finish and return")
	quit()
