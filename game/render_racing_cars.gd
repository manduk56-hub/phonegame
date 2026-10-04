extends "res://racing.gd"

func _ready() -> void:
	var review_one := "--car=1" in OS.get_cmdline_user_args()
	var pixel_review := "--pixel-review" in OS.get_cmdline_user_args()
	var rear_review := "--rear-review" in OS.get_cmdline_user_args()
	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#aab7b1") if not review_one else Color("#bac1c5")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#dbe8dc") if not review_one else Color("#ffffff")
	environment.ambient_light_energy = .45 if not review_one else .70
	env.environment = environment
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55,-35,0)
	sun.light_energy = .65
	sun.shadow_enabled = true
	add_child(sun)
	var floor_root := Node3D.new()
	add_child(floor_root)
	block(floor_root,Vector3(12,.08,12),Vector3(0,-.06,0),Color("#9aa69d") if not review_one else Color("#adb5bb"))
	merge_parts(floor_root)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 4.46 if not review_one else 4.0
	camera.position = Vector3(6,4.2,7) if review_one else Vector3(5,3.4,6)
	if rear_review: camera.position = Vector3(-5,3.4,-6)
	add_child(camera)
	camera.look_at(Vector3(0,.65,0))
	get_window().size = Vector2i(640,420) if not review_one else Vector2i(1280,840)
	if pixel_review: get_window().size = Vector2i(480,315)
	get_window().content_scale_size = get_window().size
	var ids := ["wedge","classic","tourer","muscle","exotic","gt"]
	var colors := ["#ffbf26","#eee9dc","#28559d","#e54443","#ed4239","#b8bec4"]
	var titles := ["1 · 에이펙스","2 · 클래식","3 · 그랜드","4 · 머슬","5 · 스프린트","6 · GT"]
	var layer := CanvasLayer.new()
	add_child(layer)
	var title := Label.new()
	title.position = Vector2(20,16)
	title.add_theme_font_override("font",FONT)
	title.add_theme_font_size_override("font_size",14 if pixel_review else 28)
	title.add_theme_color_override("font_color",Color("#28343d"))
	layer.add_child(title)
	var montage := Image.create(1920,840,false,Image.FORMAT_RGBA8)
	if review_one and FileAccess.file_exists("res://assets/racing-models.png"):
		montage = Image.load_from_file(ProjectSettings.globalize_path("res://assets/racing-models.png"))
	for i in range(6):
		if review_one and i != 0: continue
		title.text = titles[i]
		var car := make_car({"car":ids[i],"color":colors[i],"name":"","x":0,"z":0,"yaw":0},i)
		car.marker.hide()
		await get_tree().process_frame
		await get_tree().process_frame
		await RenderingServer.frame_post_draw
		var image := get_viewport().get_texture().get_image()
		if review_one:
			image.save_png("res://../.runtime/wedge-review.png")
		image.resize(640,420,Image.INTERPOLATE_NEAREST if pixel_review else Image.INTERPOLATE_LANCZOS)
		if not rear_review: image.save_png("res://../public/assets/race-"+ids[i]+".png")
		montage.blit_rect(image,Rect2i(0,0,640,420),Vector2i((i%3)*640,(i/3)*420))
		car.root.queue_free()
		await get_tree().process_frame
	if rear_review:
		montage.save_png("res://../.runtime/racing-models-rear.png")
	else:
		montage.save_png("res://assets/racing-models.png")
		montage.save_png("res://../public/assets/racing-models.png")
	get_tree().quit()

func _process(_delta: float) -> void:
	pass
