extends Control

const FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")
const ART = preload("res://menu_art.gd")
const GAMES = [
	["플레이룸", "포크레인 모래 쟁탈전", "팀 대결", "2–16명", "휴대폰을 운전석으로! 포크레인을 조작해\n우리 팀 구역에 가장 많은 모래를 모으세요."],
	["POCKET RACING", "작은 차, 커다란 승부", "레이싱", "준비 중", "친구들과 함께 달리는 미니 레이싱.\n새로운 경기장을 준비하고 있어요."],
	["KITCHEN PANIC", "우당탕탕 협동 주방", "협동", "준비 중", "주문이 쏟아지는 주방에서 함께 요리하세요.\n새로운 협동 게임을 준비하고 있어요."],
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
		contents.add_child(label("● 플레이 가능   /   2–16명" if i == 0 else "준비 중   /   " + GAMES[i][2],14,"#f1bd75" if i == 0 else "#a8b1ac"))
		for child in contents.get_children():
			child.mouse_filter = Control.MOUSE_FILTER_IGNORE
		card.pressed.connect(select_game.bind(i))
	var details := PanelContainer.new()
	details.custom_minimum_size.x = 430
	details.add_theme_stylebox_override("panel",panel("#eee9da","#eee9da"))
	body.add_child(details)
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation",20)
	details.add_child(info)
	info.add_child(label("선택한 게임 / GAME INFO",16,"#59615b"))
	detail_art = Control.new()
	detail_art.set_script(ART)
	detail_art.custom_minimum_size.y = 260
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
	stack.add_child(label("01  게임 선택    →    02  QR로 참가    →    03  함께 플레이                                      PLAY TOGETHER.",18,"#9ba6a5"))
	select_game(0)
	cards[0].grab_focus()
	if "--menu-capture" in OS.get_cmdline_user_args():
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
	detail_meta.text = "팀 대결   ·   최대 16명   ·   1–10분" if index == 0 else GAMES[index][2] + "   ·   새로운 게임 준비 중"
	play_button.text = "대기실 입장   →" if index == 0 else "곧 만나요!"
	play_button.disabled = index != 0

func launch_game() -> void:
	if selected != 0 or is_instance_valid(active_game):
		return
	active_game = load("res://main.tscn").instantiate()
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
	if is_instance_valid(active_game):
		back_button.disabled = active_game.state.get("phase", "lobby") == "running"
		back_button.tooltip_text = "경기를 종료하거나 대기실로 돌아온 뒤 게임을 변경하세요." if back_button.disabled else "게임 목록으로 돌아가기"

func return_to_menu() -> void:
	if not is_instance_valid(active_game) or active_game.state.get("phase", "lobby") == "running":
		return
	active_game.socket.close()
	active_game.queue_free()
	back_layer.queue_free()
	background.show()
	menu.show()
	cards[selected].grab_focus()
