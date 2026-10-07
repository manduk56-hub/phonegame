extends Control

var track: Dictionary = {}

func set_track(value: Dictionary) -> void:
	track = value
	queue_redraw()

func _draw() -> void:
	draw_style_box(get_theme_stylebox("panel", "PanelContainer"), Rect2(Vector2.ZERO,size))
	if track.is_empty():
		return
	if track.get("mode","") == "bumper":
		var radius := minf(size.x,size.y)*0.4
		draw_circle(size/2,radius,Color("#414b53"))
		draw_arc(size/2,radius,0,TAU,64,Color(track.color),3,true)
		return
	var line := PackedVector2Array()
	var scale_factor := minf(size.x/480.0,size.y/360.0)*0.9
	for point in track.points:
		line.append(Vector2(float(point.x),float(point.z))*scale_factor+size/2)
	line.append(line[0])
	draw_polyline(line,Color("#53636d"),9,true)
	draw_polyline(line,Color(track.color),4,true)
	draw_circle(line[0],5,Color("#f7e9cb"))
