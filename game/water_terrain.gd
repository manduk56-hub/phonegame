extends Node3D

const FONT = preload("res://fonts/NeoDunggeunmoPro-Regular.ttf")
var lanes: Array = []
var streaks: Array = []
var signature := ""
var clock := 0.0
var materials: Dictionary = {}

func paint(color: String) -> StandardMaterial3D:
	if not materials.has(color):
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(color)
		mat.roughness = 0.85
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		materials[color] = mat
	return materials[color]

func box(parent: Node3D, size: Vector3, pos: Vector3, color: String) -> void:
	var node := MeshInstance3D.new()
	var shape := BoxMesh.new()
	shape.size = size
	node.mesh = shape
	node.material_override = paint(color)
	node.position = pos
	parent.add_child(node)

func build(m: Dictionary) -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()
	lanes.clear()
	streaks.clear()
	var w: Dictionary = m.water
	box(self,Vector3(int(m.teamCount)*7.8+2.2,0.3,(int(w.rows)-1)*float(w.size)+5),Vector3(0,-1.05,float(w.start)+(int(w.rows)-1)*float(w.size)/2),"#56815b")
	var length := (int(w.rows)-1)*float(w.size)
	var width := (int(w.cols)-1)*float(w.size)
	var mid := float(w.start)+length/2
	for lane in w.lanes:
		var bank := Node3D.new()
		add_child(bank)
		bank.rotation.y = float(lane.angle)
		bank.position = Vector3(float(lane.x),0,float(lane.z))
		for side in [-1,1]:
			box(bank,Vector3(3,0.9,length+4),Vector3(side*(width/2+1.5),-0.45,mid),"#759368")
		box(bank,Vector3(7.8,4.2,2),Vector3(0,1.3,float(w.start)-1.3),"#68766a")
		box(bank,Vector3(3.8,3.9,0.15),Vector3(0,1.55,float(w.start)-0.22),"#7cdeef")
		for i in range(6):
			var streak := Node3D.new()
			bank.add_child(streak)
			streak.position = Vector3((i-2.5)*0.55,0,float(w.start)-0.11)
			box(streak,Vector3(0.05,0.55,0.04),Vector3.ZERO,"#e2fbff")
			streaks.append({"node":streak,"offset":float(i)/6})
		var finish := float(w.start)+length
		box(bank,Vector3(width+0.6,0.09,0.13),Vector3(0,0.06,finish),str(m.teams[int(lane.team)].color))
		box(bank,Vector3(width+0.6,0.06,0.13),Vector3(0,0.12,finish+0.2),"#fff2cd")
		var label := Label3D.new()
		label.font = FONT
		label.text = "팀 %d · 목표선" % (int(lane.team)+1)
		label.position = Vector3(0,1.8,finish)
		label.font_size = 38
		label.pixel_size = 0.014
		label.modulate = Color(m.teams[int(lane.team)].color)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.no_depth_test = true
		bank.add_child(label)
		var ground := MeshInstance3D.new()
		var dirt := paint("#ffffff").duplicate() as StandardMaterial3D
		dirt.vertex_color_use_as_albedo = true
		ground.material_override = dirt
		bank.add_child(ground)
		var flow := MeshInstance3D.new()
		flow.material_override = paint("#50cfe4")
		bank.add_child(flow)
		lanes.append({"ground":ground,"flow":flow,"revision":-1,"encoded":""})

func depth_at(depth: PackedFloat32Array, w: Dictionary, row: int, col: int) -> float:
	return depth[clampi(row,0,int(w.rows)-1)*int(w.cols)+clampi(col,0,int(w.cols)-1)]

func ground_mesh(w: Dictionary, depth: PackedFloat32Array) -> ArrayMesh:
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	var cols := int(w.cols)
	var rows := int(w.rows)
	var size := float(w.size)
	for row in range(rows):
		for col in range(cols):
			var i := row*cols+col
			var d := depth[i]
			vertices.append(Vector3((col-(cols-1)/2.0)*size,-d,float(w.start)+row*size))
			var nx := (depth_at(depth,w,row,col+1)-depth_at(depth,w,row,col-1))/(2*size)
			var nz := (depth_at(depth,w,row+1,col)-depth_at(depth,w,row-1,col))/(2*size)
			normals.append(Vector3(nx,1,nz).normalized())
			var shade := 1.0-minf(0.48,maxf(0.0,d)*1.1)
			colors.append(Color(0.82*shade,0.66*shade,0.40*shade))
			if row < rows-1 and col < cols-1:
				var b := i+cols
				indices.append_array(PackedInt32Array([i,b,i+1,i+1,b,b+1]))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	return mesh

func water_point(w: Dictionary, depth: PackedFloat32Array, wet: PackedFloat32Array, i: int) -> Vector3:
	var cols := int(w.cols)
	return Vector3((i%cols-(cols-1)/2.0)*float(w.size),minf(wet[i]-0.04,(depth[i]+float(w.level))*4),float(w.start)+floori(float(i)/cols)*float(w.size))

func clip_triangle(input: Array, level: float, vertices: PackedVector3Array) -> void:
	var clipped: Array[Vector3] = []
	for i in range(3):
		var a: Vector3 = input[i]
		var b: Vector3 = input[(i+1)%3]
		if a.y > 0:
			clipped.append(a)
		if (a.y > 0) != (b.y > 0):
			clipped.append(a.lerp(b,a.y/(a.y-b.y)))
	for i in range(1,clipped.size()-1):
		for point in [clipped[0],clipped[i],clipped[i+1]]:
			vertices.append(Vector3(point.x,level+0.006,point.z))

func water_mesh(w: Dictionary, depth: PackedFloat32Array, wet: PackedFloat32Array) -> ArrayMesh:
	var vertices := PackedVector3Array()
	var cols := int(w.cols)
	for row in range(int(w.rows)-1):
		for col in range(cols-1):
			var a := row*cols+col
			var b := a+cols
			if maxf(maxf(wet[a],wet[b]),maxf(wet[a+1],wet[b+1])) <= 0.04:
				continue
			var pa := water_point(w,depth,wet,a)
			var pb := water_point(w,depth,wet,b)
			var pc := water_point(w,depth,wet,a+1)
			var pd := water_point(w,depth,wet,b+1)
			clip_triangle([pa,pb,pc],float(w.level),vertices)
			clip_triangle([pc,pb,pd],float(w.level),vertices)
	var mesh := ArrayMesh.new()
	if vertices.is_empty():
		return mesh
	var normals := PackedVector3Array()
	normals.resize(vertices.size())
	normals.fill(Vector3.UP)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	return mesh

func update_surface(m: Dictionary) -> void:
	var w: Dictionary = m.water
	var key := JSON.stringify([m.excavatorMap.id,m.teamCount,w.rows,w.cols,w.size,w.start,w.lanes.map(func(l):return [l.x,l.z,l.angle])])
	if signature != key:
		signature = key
		build(m)
	visible = m.phase != "finished"
	for i in range(w.lanes.size()):
		var lane: Dictionary = w.lanes[i]
		var surface: Dictionary = lanes[i]
		if surface.encoded == lane.surface:
			continue
		surface.encoded = lane.surface
		var bytes := Marshalls.base64_to_raw(str(lane.surface))
		var count := int(w.rows)*int(w.cols)
		if bytes.size() != count*3:
			push_error("Invalid water surface")
			continue
		var depth := PackedFloat32Array()
		var wet := PackedFloat32Array()
		depth.resize(count)
		wet.resize(count)
		for j in range(count):
			depth[j] = bytes.decode_u16(j*3)/1000.0
			wet[j] = float(bytes[j*3+2])/255.0
		if int(surface.revision) != int(lane.revision):
			surface.revision = lane.revision
			surface.ground.mesh = ground_mesh(w,depth)
		surface.flow.mesh = water_mesh(w,depth,wet)
		surface.flow.visible = surface.flow.mesh.get_surface_count()>0

func _process(delta: float) -> void:
	clock += delta
	for streak in streaks:
		streak.node.position.y = 3.4-fmod(clock*1.2+float(streak.offset),1.0)*3.6
