extends Control

var source: Node3D
var main_view: Dictionary
var tiles: Dictionary = {}
var current_state: Dictionary = {}

func make_view() -> Dictionary:
	var holder := Control.new()
	add_child(holder)
	var container := SubViewportContainer.new()
	container.stretch = true
	container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	holder.add_child(container)
	var viewport := SubViewport.new()
	viewport.size = Vector2i(480,270)
	viewport.world_3d = source.get_viewport().world_3d
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	container.add_child(viewport)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 48
	viewport.add_child(cam)
	cam.current = true
	var label := Label.new()
	label.add_theme_font_size_override("font_size",16)
	label.add_theme_color_override("font_shadow_color",Color.BLACK)
	label.add_theme_constant_override("shadow_offset_x",2)
	label.add_theme_constant_override("shadow_offset_y",2)
	label.position = Vector2(8,8)
	holder.add_child(label)
	var map := Control.new()
	map.set_script(preload("res://race_minimap.gd"))
	map.position = Vector2(6,30)
	map.size = Vector2(55,34)
	holder.add_child(map)
	holder.clip_contents = true
	return {"holder":holder,"viewport":viewport,"camera":cam,"label":label,"map":map}

func setup(value: Node3D) -> void:
	source = value
	var backdrop := ColorRect.new()
	backdrop.color = Color("#13232d")
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(backdrop)
	main_view = make_view()
	main_view.map.position = Vector2(10,38)
	main_view.map.size = Vector2(140,88)

func update_state(value: Dictionary) -> void:
	current_state = value
	visible = value.phase != "lobby" and not value.players.is_empty()
	for p in value.players:
		if not tiles.has(p.id):
			tiles[p.id] = make_view()
	for id in tiles.keys():
		if not value.players.any(func(p):return p.id == id):
			tiles[id].holder.queue_free()
			tiles.erase(id)

func aim(view: Dictionary, p: Dictionary, feature := false) -> void:
	var target: Vector3 = source.cars[p.id].root.position
	view.camera.cull_mask = 1048575
	if p.get("viewMode","third") == "first":
		view.camera.projection = Camera3D.PROJECTION_PERSPECTIVE
		view.camera.fov = 78+24*smoothstep(5,70,maxf(0,float(p.speed)))
		var forward := Vector3(sin(float(p.yaw)),0,cos(float(p.yaw)))
		view.camera.position = target+forward*.2+Vector3(0,1.35,0)
		view.camera.look_at(view.camera.position+forward*20-Vector3(0,.2,0))
		var index: int = current_state.players.find(p)
		view.camera.cull_mask = 1048575 & ~(1 << (index+1))
	else:
		view.camera.projection = Camera3D.PROJECTION_ORTHOGONAL
		view.camera.size = (48+6*smoothstep(5,70,maxf(0,float(p.speed))))*view.holder.size.x/view.holder.size.y
		view.camera.position = target+Vector3(6,32,12)
		view.camera.look_at(target)
	view.label.text = "%d위 · %s · %d km/h%s" % [int(p.rank),p.name,roundi(absf(float(p.speed))*3.6),"" if p.connected else " · 오프라인"]
	view.label.modulate = Color(p.color)
	view.label.size.x = view.holder.size.x-16
	view.label.clip_text = true
	view.label.add_theme_font_size_override("font_size",16 if feature else 12)
	view.map.set_state(current_state,p.id)
	if feature:
		var selection: Dictionary = current_state.race.get("broadcast",{}) if current_state.race.get("broadcast") is Dictionary else {}
		view.label.text = str(selection.get("reason","순환 중계"))+" / "+view.label.text
		view.map.set_state(current_state,p.id)

func _process(_delta: float) -> void:
	if not visible or current_state.is_empty():
		return
	var main_width := size.x*.64
	main_view.holder.position = Vector2.ZERO
	main_view.holder.size = Vector2(main_width,size.y)
	main_view.viewport.size = Vector2i(main_width*.8,size.y*.8)
	var selection: Dictionary = current_state.race.get("broadcast",{}) if current_state.race.get("broadcast") is Dictionary else {}
	var selected = selection.get("id")
	var featured: Dictionary = current_state.players[0]
	for p in current_state.players:
		if p.id == selected:
			featured = p
	var count: int = tiles.size()
	var columns := 2 if count <= 8 else 3
	var rows := ceili(float(count)/columns)
	var tile_size := Vector2((size.x-main_width-12)/columns,size.y/rows)
	for i in range(current_state.players.size()):
		var p: Dictionary = current_state.players[i]
		var tile: Dictionary = tiles[p.id]
		tile.holder.position = Vector2(main_width+12+(i%columns)*tile_size.x,floori(float(i)/columns)*tile_size.y)
		tile.holder.size = tile_size-Vector2(6,6)
		tile.viewport.size = Vector2i(maxi(160,int(tile_size.x*.7)),maxi(90,int(tile_size.y*.7)))
		aim(tile,p)
	aim(main_view,featured,true)
