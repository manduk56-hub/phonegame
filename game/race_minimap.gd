extends Control

var state: Dictionary = {}
var player_id = null
var clock := 0.0

func set_state(value: Dictionary, id) -> void:
	state = value
	player_id = id
	queue_redraw()

func _process(delta: float) -> void:
	clock += delta
	queue_redraw()

func _draw() -> void:
	if state.is_empty():
		return
	draw_rect(Rect2(Vector2.ZERO,size),Color("#13232ddd"))
	var bounds: Dictionary = state.circuit.bounds
	var span := Vector2(float(bounds.maxX)-float(bounds.minX),float(bounds.maxZ)-float(bounds.minZ))
	var center := Vector2((float(bounds.minX)+float(bounds.maxX))/2,(float(bounds.minZ)+float(bounds.maxZ))/2)
	var factor := minf((size.x-20)/span.x,(size.y-20)/span.y)
	var points := PackedVector2Array()
	for p in state.circuit.points:
		points.append((Vector2(p.x,p.z)-center)*factor+size/2)
	points.append(points[0])
	draw_polyline(points,Color("#637b83"),6,true)
	draw_polyline(points,Color("#d0ddd6"),2,true)
	for p in state.players:
		var pos := (Vector2(p.x,p.z)-center)*factor+size/2
		var color := Color(p.color)
		if p.id == player_id:
			for radius in range(10,3,-2):
				draw_circle(pos,radius+sin(clock*5),Color(color,.12))
			draw_circle(pos,4,color)
			draw_circle(pos,2,Color.WHITE)
		else:
			draw_circle(pos,2,Color(color,.6))
