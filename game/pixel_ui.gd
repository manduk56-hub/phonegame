extends RefCounted

const FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")

# Nine-slice pixel corners stay crisp at every control size.
static func tile(fill: String = "#414d43", edge: String = "#9eac88", pressed := false) -> StyleBoxTexture:
	var image := Image.create(24,24,false,Image.FORMAT_RGBA8)
	image.fill(Color.TRANSPARENT)
	for y in range(24):
		for x in range(24):
			var cut := 4 if y < 2 or y > 21 else (2 if y < 4 or y > 19 else 0)
			if x < cut or x >= 24-cut:
				continue
			var color := Color(fill)
			if x < cut+2 or x >= 22-cut or y < 2 or y > 21:
				color = Color("#202b28")
			elif y < 5 or x < 4:
				color = Color(edge).darkened(0.35) if pressed else Color(edge)
			elif y > 17 or x > 19:
				color = Color(edge) if pressed else Color(fill).darkened(0.35)
			image.set_pixel(x,y,color)
	var style := StyleBoxTexture.new()
	style.texture = ImageTexture.create_from_image(image)
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:
		style.set_texture_margin(side,6)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 8
	style.content_margin_bottom = 10
	return style

static func apply(theme: Theme) -> void:
	theme.default_font = FONT
	for type in ["Button","OptionButton","LineEdit"]:
		theme.set_stylebox("normal",type,tile())
		theme.set_stylebox("hover",type,tile("#556453","#e8ca8a"))
		theme.set_stylebox("pressed",type,tile("#354239","#e8ca8a",true))
		theme.set_stylebox("disabled",type,tile("#343d38","#677268"))
		var focus := StyleBoxFlat.new()
		focus.bg_color = Color.TRANSPARENT
		focus.border_color = Color("#ffe0a0")
		focus.set_border_width_all(2)
		focus.set_expand_margin_all(2)
		theme.set_stylebox("focus",type,focus)
		for state in ["font_color","font_hover_color","font_pressed_color","font_focus_color"]:
			theme.set_color(state,type,Color("#fff0cf"))
		theme.set_color("font_disabled_color",type,Color("#919b8a"))
		theme.set_color("font_selected_color",type,Color("#fff0cf"))
		theme.set_color("selection_color",type,Color("#65775d"))
	theme.set_stylebox("read_only","LineEdit",tile("#343d38","#677268"))
	theme.set_stylebox("panel","PopupMenu",tile("#303d35","#9eac88"))
	theme.set_stylebox("hover","PopupMenu",tile("#556453","#e8ca8a"))
	theme.set_color("font_color","PopupMenu",Color("#fff0cf"))
	theme.set_color("font_hover_color","PopupMenu",Color("#ffe0a0"))
	theme.set_constant("v_separation","PopupMenu",12)
	theme.set_constant("h_separation","PopupMenu",12)
	theme.set_constant("arrow_margin","OptionButton",10)
	theme.set_stylebox("panel","AcceptDialog",tile("#303d35","#e8ca8a"))

static func primary(button: Button) -> void:
	button.add_theme_stylebox_override("normal",tile("#efb96d","#ffe3a6"))
	button.add_theme_stylebox_override("hover",tile("#ffcb85","#fff0c9"))
	button.add_theme_stylebox_override("pressed",tile("#d6a15e","#ffe3a6",true))
	for state in ["font_color","font_hover_color","font_pressed_color","font_focus_color"]:
		button.add_theme_color_override(state,Color("#28352e"))
