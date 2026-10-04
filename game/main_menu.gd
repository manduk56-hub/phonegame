extends Control

const FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")
const ART = preload("res://menu_art.gd")
const GAMES = [
	["플레이룸", "모래 쟁탈전 · 폭포 물길 경주", "팀 대결", "2–16명", "휴대폰을 운전석으로! 포크레인을 조작해\n모래를 모으거나 폭포에서 목표선까지 물길을 파세요."],
	["POCKET RACING", "작은 차, 커다란 승부", "레이싱", "1–16명", "폰을 기울여 핸들을 돌리고 페달을 밟으세요.\n여섯 스포츠카 · 3바퀴 · 차량 충돌 사용"],
	["FLAG STRIKE", "조준 · 탈환 · 귀환", "FPS", "2–16명", "폰 전체 화면에서 1인칭으로 조준하고 발사!\n중앙 깃발을 우리 진영으로 가져오세요."],
	["PARTY MIX", "다 같이 즐기는 미니게임", "파티", "준비 중", "짧고 신나는 미니게임으로 한판 더!\n새로운 파티 게임을 준비하고 있어요."]
]
var menu: MarginContainer
var background: ColorRect
var cards: Array[Button] = []
var detail_art: Control
var detail_title: Label
var detail_subtitle: Label
var detail_description: Label
var detail_meta: Label
var play_button: Button
var selected := 0
var active_game: Node
var back_layer: CanvasLayer
var back_button: Button
var qr: TextureRect
var join_label: Label
var roster_label: Label
var socket := WebSocketPeer.new()
var server_url := "http://127.0.0.1:3000"
var admin_key := ""
var elapsed := 0.0
var last_config := -5.0
var config_pending := false
var connection_signature := ""

func panel(color: String, border: String = "#3b4243") -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(color)
	style.border_color = Color(border)
	style.set_border_width_all(2)
	style.set_content_margin_all(20)
	return style

func label(text: String, font_size: int, color: String = "#eee9da") -> Label:
	var result := Label.new()
	result.text = text
	result.add_theme_font_size_override("font_size", font_size)
	result.add_theme_color_override("font_color", Color(color))
	return result

func _ready() -> void:
	# Existing fixture/render tools continue to launch the arena directly.
	for arg in OS.get_cmdline_user_args():
		if arg in ["--race","--race-capture"]:
			get_tree().change_scene_to_file.call_deferred("res://racing.tscn")
			return
		if arg in ["--preview", "--model-preview", "--capture"] or arg.begins_with("--fixture="):
			get_tree().change_scene_to_file.call_deferred("res://main.tscn")
			return
	var theme_resource := Theme.new()
	theme_resource.default_font = FONT
	theme_resource.default_font_size = 20
	theme = theme_resource
	background = ColorRect.new()
	background.color = Color("#181e20")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	menu = MarginContainer.new()
	menu.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right"]:
		menu.add_theme_constant_override("margin_"+side,64)
	for side in ["top", "bottom"]:
		menu.add_theme_constant_override("margin_"+side,32)
	add_child(menu)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation",24)
	menu.add_child(stack)
	var header := HBoxContainer.new()
	stack.add_child(header)
	var brand := label("플레이룸 / 함께 노는 시간",24,"#f17c64")
	brand.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(brand)
	header.add_child(label("하나의 화면 · 각자의 휴대폰",18,"#9ba6a5"))
	stack.add_child(label("오늘은 어떤 게임을 할까요?",48))
	stack.add_child(label("친구들을 모으고, 게임을 고르고, 함께 시작하세요.",20,"#a8b1ac"))
	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation",28)
	stack.add_child(body)
	var square_area := AspectRatioContainer.new()
	square_area.ratio = 1.0
	square_area.stretch_mode = AspectRatioContainer.STRETCH_FIT
	square_area.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(square_area)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation",18)
	grid.add_theme_constant_override("v_separation",18)
	square_area.add_child(grid)
	for i in range(GAMES.size()):
		var card := Button.new()
		card.name = "GameCard%d" % i
		card.custom_minimum_size = Vector2(250,250)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		card.size_flags_vertical = Control.SIZE_EXPAND_FILL
		card.add_theme_stylebox_override("normal",panel("#252d2e"))
		card.add_theme_stylebox_override("hover",panel("#303a39","#f17c64"))
		card.add_theme_stylebox_override("focus",panel("#303a39","#eee9da"))
		grid.add_child(card)
		cards.append(card)
		var contents := VBoxContainer.new()
		contents.mouse_filter = Control.MOUSE_FILTER_IGNORE
		contents.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		contents.offset_left = 14
		contents.offset_right = -14
		contents.offset_top = 14
		contents.offset_bottom = -14
		card.add_child(contents)
		var art := Control.new()
		art.set_script(ART)
		art.kind = i
		art.custom_minimum_size.y = 100
		art.size_flags_vertical = Control.SIZE_EXPAND_FILL
		contents.add_child(art)
		contents.add_child(label(GAMES[i][0],22))
		contents.add_child(label(GAMES[i][1],16,"#a8b1ac"))
		contents.add_child(label("● 플레이 가능   /   " + GAMES[i][3] if i < 3 else "준비 중   /   " + GAMES[i][2],14,"#f1bd75" if i < 3 else "#a8b1ac"))
		for child in contents.get_children():
			child.mouse_filter = Control.MOUSE_FILTER_IGNORE
		card.pressed.connect(select_game.bind(i))
	var details := PanelContainer.new()
	details.custom_minimum_size.x = 430
	details.add_theme_stylebox_override("panel",panel("#eee9da","#eee9da"))
	body.add_child(details)
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation",14)
	details.add_child(info)
	info.add_child(label("선택한 게임 / GAME INFO",16,"#59615b"))
	detail_art = Control.new()
	detail_art.set_script(ART)
	detail_art.custom_minimum_size.y = 130
	info.add_child(detail_art)
	detail_title = label("",32,"#232b2b")
	info.add_child(detail_title)
	detail_subtitle = label("",20,"#59615b")
	info.add_child(detail_subtitle)
	detail_description = label("",20,"#59615b")
	detail_description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_description.size_flags_vertical = Control.SIZE_EXPAND_FILL
	info.add_child(detail_description)
	detail_meta = label("",18,"#59615b")
	info.add_child(detail_meta)
	play_button = Button.new()
	play_button.custom_minimum_size.y = 64
	play_button.add_theme_stylebox_override("normal",panel("#f17c64","#f17c64"))
	play_button.add_theme_stylebox_override("hover",panel("#ff947c","#ff947c"))
	play_button.add_theme_stylebox_override("disabled",panel("#d3d2c7","#d3d2c7"))
	play_button.add_theme_color_override("font_color",Color("#232b2b"))
	play_button.add_theme_font_size_override("font_size",24)
	play_button.pressed.connect(launch_game)
	info.add_child(play_button)
	var join_row := HBoxContainer.new()
	join_row.add_theme_constant_override("separation",14)
	info.add_child(join_row)
	qr = TextureRect.new()
	qr.custom_minimum_size = Vector2(150,150)
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	qr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	join_row.add_child(qr)
	var join_info := VBoxContainer.new()
	join_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	join_row.add_child(join_info)
	join_info.add_child(label("QR 한 번으로 참가",20,"#232b2b"))
	var help := label("게임을 바꿔도\n이 폰으로 계속 플레이!",16,"#59615b")
	join_info.add_child(help)
	roster_label = label("서버 연결 중…",18,"#59615b")
	join_info.add_child(roster_label)
	join_label = label("참가 주소를 불러오는 중…",12,"#59615b")
	join_label.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	join_label.custom_minimum_size.x = 200
	join_info.add_child(join_label)
	stack.add_child(label("01  QR로 한 번 참가    →    02  게임 선택    →    03  계속 함께 플레이                           PLAY TOGETHER.",18,"#9ba6a5"))
	select_game(0)
	cards[0].grab_focus()
	server_url = OS.get_environment("DIRT_RALLY_SERVER_URL").trim_suffix("/") if OS.has_environment("DIRT_RALLY_SERVER_URL") else server_url
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			server_url = arg.trim_prefix("--server=").trim_suffix("/")
	fetch_config()
	if "--menu-capture" in OS.get_cmdline_user_args():
		var deadline := Time.get_ticks_msec()+4000
		while qr.texture == null and Time.get_ticks_msec() < deadline:
			await get_tree().process_frame
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://../.runtime/game-menu.png")
		get_tree().quit()

func select_game(index: int) -> void:
	selected = index
	for i in range(cards.size()):
		cards[i].add_theme_stylebox_override("normal",panel("#303a39" if i == index else "#252d2e","#f17c64" if i == index else "#3b4243"))
	detail_art.kind = index
	detail_art.queue_redraw()
	detail_title.text = GAMES[index][0]
	detail_subtitle.text = GAMES[index][1]
	detail_description.text = GAMES[index][4]
	detail_meta.text = "팀 대결   ·   최대 16명   ·   1–10분" if index == 0 else ("레이싱 · 최대 16명 · 폰 기울기 조작" if index == 1 else ("FPS · 2–8팀 · 깃발 쟁탈전 · 2초 뒤 부활" if index == 2 else GAMES[index][2] + "   ·   새로운 게임 준비 중"))
	play_button.text = "대기실 입장   →" if index < 3 else "곧 만나요!"
	play_button.disabled = index > 2

func launch_game() -> void:
	if selected > 2 or is_instance_valid(active_game):
		return
	active_game = load(["res://main.tscn","res://racing.tscn","res://fps.tscn"][selected]).instantiate()
	add_child(active_game)
	menu.hide()
	background.hide()
	back_layer = CanvasLayer.new()
	back_layer.layer = 20
	add_child(back_layer)
	back_button = Button.new()
	back_button.text = "← 게임 선택"
	back_button.position = Vector2(20,90)
	back_button.add_theme_stylebox_override("normal",panel("#252d2e"))
	back_button.pressed.connect(return_to_menu)
	back_layer.add_child(back_button)

func _process(_delta: float) -> void:
	elapsed += _delta
	if not is_instance_valid(qr):
		return
	if elapsed-last_config > 3.0:
		fetch_config()
	socket.poll()
	if socket.get_ready_state() == WebSocketPeer.STATE_CLOSED and not admin_key.is_empty():
		socket.remove_meta("joined")
		socket.connect_to_url(server_url.replace("https://","wss://").replace("http://","ws://"))
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		if not socket.has_meta("joined"):
			socket.send_text(JSON.stringify({"type":"host","key":admin_key}))
			socket.set_meta("joined",true)
		while socket.get_available_packet_count() > 0:
			var message = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if message is Dictionary and message.get("type") == "state":
				var connected: Array = message.players.filter(func(p):return p.connected)
				roster_label.text = "접속 %d / 16명" % connected.size()
				var signature := JSON.stringify(message.get("connection",{}))
				if signature != connection_signature:
					connection_signature = signature
					fetch_config()
	if is_instance_valid(active_game):
		back_button.disabled = active_game.state.get("phase", "lobby") == "running"
		back_button.tooltip_text = "경기를 종료하거나 대기실로 돌아온 뒤 게임을 변경하세요." if back_button.disabled else "게임 목록으로 돌아가기"

func return_to_menu() -> void:
	if not is_instance_valid(active_game) or active_game.state.get("phase", "lobby") == "running":
		return
	active_game.send_admin({"type":"lobby"})
	active_game.socket.poll()
	active_game.socket.close()
	active_game.queue_free()
	back_layer.queue_free()
	background.show()
	menu.show()
	cards[selected].grab_focus()

func fetch_config() -> void:
	if config_pending:
		return
	config_pending = true
	last_config = elapsed
	var request := HTTPRequest.new()
	request.timeout = 3.0
	add_child(request)
	request.request_completed.connect(func(_result,code,_headers,body):
		config_pending = false
		if code == 200:
			var config = JSON.parse_string(body.get_string_from_utf8())
			if config is Dictionary and config.get("app") == "dirt-rally":
				admin_key = OS.get_environment("DIRT_RALLY_HOST_KEY") if config.get("hostAuth") == "token" else str(config.get("adminKey",""))
				var target := "%s/controller?room=%s" % [config.joinAddress,config.room]
				if join_label.text != target or qr.texture == null:
					join_label.text = target
					load_qr()
		request.queue_free()
	)
	if request.request(server_url+"/config") != OK:
		config_pending = false
		request.queue_free()

func load_qr() -> void:
	var request := HTTPRequest.new()
	request.timeout = 3.0
	add_child(request)
	request.request_completed.connect(func(_result,code,_headers,body):
		if code == 200:
			var image := Image.new()
			if image.load_svg_from_buffer(body) == OK:
				qr.texture = ImageTexture.create_from_image(image)
		request.queue_free()
	)
	request.request(server_url+"/qr")

func _exit_tree() -> void:
	socket.close()
