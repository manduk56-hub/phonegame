extends RefCounted

static func mesh(p: Dictionary) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var normals := [Vector3.RIGHT,Vector3.LEFT,Vector3.UP,Vector3.DOWN,Vector3.BACK,Vector3.FORWARD]
	var faces := [
		[Vector3(1,-1,-1),Vector3(1,1,-1),Vector3(1,1,1),Vector3(1,-1,1)],
		[Vector3(-1,-1,1),Vector3(-1,1,1),Vector3(-1,1,-1),Vector3(-1,-1,-1)],
		[Vector3(-1,1,-1),Vector3(-1,1,1),Vector3(1,1,1),Vector3(1,1,-1)],
		[Vector3(-1,-1,1),Vector3(-1,-1,-1),Vector3(1,-1,-1),Vector3(1,-1,1)],
		[Vector3(1,-1,1),Vector3(1,1,1),Vector3(-1,1,1),Vector3(-1,-1,1)],
		[Vector3(-1,-1,-1),Vector3(-1,1,-1),Vector3(1,1,-1),Vector3(1,-1,-1)]]
	for cell in p.cells:
		var center := Vector3(cell[0],cell[1],cell[2])*float(p.cell)
		surface.set_color(Color(p.palette[int(cell[3])]))
		for side in range(6):
			if (int(cell[4]) & (1 << side)) == 0:
				continue
			surface.set_normal(normals[side])
			for index in [0,2,1,0,3,2]:
				surface.add_vertex(center+faces[side][index]*float(p.cell)*.5)
	return surface.commit()

