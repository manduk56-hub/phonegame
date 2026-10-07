extends RefCounted

# Shared preparation layout, matching the excavator lobby.
static func setup(ui: Control, lobby: PanelContainer, qr: TextureRect, address: Label, start: Button, roster: Control) -> void:
	lobby.name = "PreparationLobby"
	lobby.custom_minimum_size = Vector2.ZERO
	lobby.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	lobby.offset_left = -500
	lobby.offset_right = 460
	lobby.offset_top = -308
	lobby.offset_bottom = 308
	var theme := Theme.new()
	theme.default_font_size = 20
	preload("res://pixel_ui.gd").apply(theme)
	theme.set_color("font_color","Label",Color("#f7edd3"))
	lobby.theme = theme
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#292d26")
	style.border_color = Color("#758064")
	style.set_border_width_all(2)
	style.content_margin_left = 24
	style.content_margin_right = 24
	style.content_margin_top = 20
	style.content_margin_bottom = 20
	lobby.add_theme_stylebox_override("panel",style)
	var layout: VBoxContainer = lobby.get_child(0)
	layout.add_theme_constant_override("separation",12)
	var title: Label = layout.get_child(0)
	title.add_theme_font_size_override("font_size",30)
	title.add_theme_color_override("font_color",Color("#faad28"))
	var header := HBoxContainer.new()
	layout.add_child(header)
	layout.move_child(header,0)
	title.reparent(header)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var close := Button.new()
	close.text = "닫기"
	close.pressed.connect(func():lobby.hide())
	header.add_child(close)
	var join_panel := PanelContainer.new()
	join_panel.name = "PreparationJoinCard"
	join_panel.theme = theme
	join_panel.add_theme_stylebox_override("panel",style.duplicate())
	ui.add_child(join_panel)
	join_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	join_panel.offset_left = -324
	join_panel.offset_right = -20
	join_panel.offset_top = 16
	join_panel.offset_bottom = 304
	var join_layout := VBoxContainer.new()
	join_panel.add_child(join_layout)
	qr.reparent(join_layout)
	qr.custom_minimum_size = Vector2(200,200)
	address.reparent(join_layout)
	address.custom_minimum_size = Vector2.ZERO
	address.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	address.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	address.add_theme_font_size_override("font_size",16)
	if roster.get_parent() is ScrollContainer:
		var scroll: ScrollContainer = roster.get_parent()
		scroll.custom_minimum_size.y = 0
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		roster.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		roster.add_theme_constant_override("separation",8)
	else:
		var scroll := ScrollContainer.new()
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		var index := roster.get_index()
		layout.add_child(scroll)
		layout.move_child(scroll,index)
		roster.reparent(scroll)
		roster.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	start.custom_minimum_size.y = 48
	preload("res://pixel_ui.gd").primary(start)
	layout.move_child(start,layout.get_child_count()-1)
	var manage := Button.new()
	manage.text = "대기실 / 경기 설정"
	manage.theme = theme
	ui.add_child(manage)
	manage.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	manage.offset_left = -520
	manage.offset_right = -300
	manage.offset_top = -65
	manage.offset_bottom = -20
	manage.pressed.connect(func():lobby.visible = not lobby.visible)
	lobby.visibility_changed.connect(func():join_panel.visible = lobby.visible)

static func sync(lobby: PanelContainer, phase: String) -> void:
	if lobby.get_meta("phase","") != phase:
		lobby.set_meta("phase",phase)
		lobby.visible = phase == "lobby"
