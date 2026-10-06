extends Control

var kind := 0
var excavator_texture: Texture2D
var racing_texture: Texture2D
var fps_texture: Texture2D

func _draw() -> void:
	if kind == 3:
		var bull_texture = load("res://bull-card.png")
		var image_size: Vector2 = bull_texture.get_size()
		var ratio := minf(size.x/image_size.x,size.y/image_size.y)
		draw_texture_rect(bull_texture,Rect2((size-image_size*ratio)/2,image_size*ratio),false)
		return
	if kind == 2 and fps_texture != null:
		var image_size := fps_texture.get_size()
		var ratio := maxf(size.x/image_size.x,size.y/image_size.y)
		draw_texture_rect(fps_texture,Rect2((size-image_size*ratio)/2,image_size*ratio),false)
		return
	if kind == 1 and racing_texture != null:
		var image_size := Vector2(1920,840)
		var ratio := minf(size.x/image_size.x,size.y/image_size.y)
		draw_texture_rect(racing_texture,Rect2((size-image_size*ratio)/2,image_size*ratio),false)
		return
	if kind == 0 and excavator_texture != null:
		# Cover the image area while preserving the square render's proportions.
		var edge := maxf(size.x,size.y)
		draw_texture_rect(excavator_texture,Rect2((size-Vector2.ONE*edge)/2,Vector2.ONE*edge),false)
		return
	var colors := [Color("#b7ba8b"), Color("#9cb8d4"), Color("#cfafa2"), Color("#b9afd0")]
	draw_rect(Rect2(Vector2.ZERO,size),colors[kind])
	var scale_factor := minf(size.x/400.0,size.y/160.0)
	draw_set_transform((size-Vector2(400,160)*scale_factor)/2,0,Vector2.ONE*scale_factor)
	draw_rect(Rect2(0, 0, 400, 160), colors[kind])
	for x in range(0, 400, 40):
		draw_line(Vector2(x, 0), Vector2(x, 160), Color(1, 1, 1, 0.1))
	for y in range(0, 160, 40):
		draw_line(Vector2(0, y), Vector2(400, y), Color(1, 1, 1, 0.1))
	var ink := Color("#252b30")
	if kind == 0:
		draw_rect(Rect2(0, 135, 400, 25), Color("#7d805b"))
		draw_colored_polygon(PackedVector2Array([Vector2(265,135),Vector2(318,79),Vector2(364,135)]),Color("#e4c18c"))
		draw_style_box(track_style(), Rect2(83, 113, 147, 28))
		for x in range(99, 225, 25):
			draw_circle(Vector2(x,127),8,Color("#555c58"))
		draw_rect(Rect2(95,84,400/3.0,30),Color("#f1b94a"))
		draw_rect(Rect2(105,40,62,48),ink)
		draw_rect(Rect2(114,49,43,30),Color("#c9e4e2"))
		draw_polyline(PackedVector2Array([Vector2(194,88),Vector2(239,27),Vector2(292,86)]),ink,19)
		draw_polyline(PackedVector2Array([Vector2(194,88),Vector2(239,27),Vector2(292,86)]),Color("#f1b94a"),12)
		draw_colored_polygon(PackedVector2Array([Vector2(277,82),Vector2(313,88),Vector2(302,115),Vector2(279,108)]),ink)
	elif kind == 1:
		draw_rect(Rect2(0,97,400,63),Color("#4d657a"))
		for x in range(10,400,70):
			draw_rect(Rect2(x,125,35,4),Color("#d9e3dc"))
		for x in [110,230]:
			draw_rect(Rect2(x,73,68,32),Color("#ed795e") if x == 110 else Color("#f2d37b"))
			draw_rect(Rect2(x+12,52,42,24),Color("#dce9e9"))
			for wheel in [x+12,x+56]:
				draw_circle(Vector2(wheel,106),11,ink)
	elif kind == 2:
		draw_rect(Rect2(0,110,400,50),Color("#657d75"))
		draw_rect(Rect2(50,60,75,65),Color("#b4ad92"))
		draw_rect(Rect2(270,80,80,65),Color("#b4ad92"))
		draw_line(Vector2(195,140),Vector2(195,22),Color("#eee9d4"),6)
		draw_rect(Rect2(198,24,65,25),Color("#ffe45c"))
		draw_rect(Rect2(130,112,35,40),Color("#f07866"))
		draw_circle(Vector2(147,101),12,Color("#ead5ae"))
		draw_line(Vector2(200,66),Vector2(200,94),Color.WHITE,3)
		draw_line(Vector2(186,80),Vector2(214,80),Color.WHITE,3)
	else:
		for item in [Vector3(106,87,0),Vector3(169,55,1),Vector3(233,87,2),Vector3(296,55,3)]:
			draw_rect(Rect2(item.x-24,item.y+22,48,35),ink)
			draw_circle(Vector2(item.x,item.y),22,[Color("#f0c667"),Color("#d77a88"),Color("#80bab1"),Color("#eee4d4")][int(item.z)])
			draw_rect(Rect2(item.x-10,item.y-3,5,5),ink)
			draw_rect(Rect2(item.x+5,item.y-3,5,5),ink)

func track_style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#252b30")
	style.set_corner_radius_all(12)
	return style

func _ready() -> void:
	clip_contents = true
	excavator_texture = load("res://assets/dirt-rally-card.png")
	fps_texture = load("res://assets/fps-model-card.png")
	racing_texture = load("res://assets/racing-models.png")
	resized.connect(queue_redraw)
