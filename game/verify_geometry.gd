extends SceneTree

func _initialize() -> void:
	verify.call_deferred()

func verify() -> void:
	var fixture_path := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--fixture="):
			fixture_path = arg.trim_prefix("--fixture=")
	if fixture_path.is_empty():
		printerr("Missing geometry fixture")
		quit(1)
		return
	var fixture = JSON.parse_string(FileAccess.get_file_as_string(fixture_path))
	if not fixture is Dictionary:
		printerr("Invalid geometry fixture")
		quit(1)
		return
	var world = load("res://main.gd").new()
	root.add_child(world)
	world.accept_state(fixture)
	world._process(1.0)
	var maximum_error := 0.0
	for p in fixture.players:
		var actual: Vector3 = world.machines[p.id].bucket.to_global(Vector3(0,-0.48,-0.73))
		var expected := Vector3(p.bucket.x,p.bucket.height,p.bucket.z)
		var error := actual.distance_to(expected)
		maximum_error = maxf(maximum_error,error)
		if error > 0.0001:
			printerr("Bucket geometry mismatch for ",p.name,": ",error)
			quit(1)
			return
	print("Verified ",fixture.players.size()," rendered bucket poses against authoritative simulation. Maximum error: ",maximum_error)
	if fixture.get("water") is Dictionary:
		var w: Dictionary = fixture.water
		var lanes: Array = world.water_root.get("lanes")
		var water_vertices := 0
		for i in range(lanes.size()):
			var bytes := Marshalls.base64_to_raw(str(w.lanes[i].surface))
			var arrays: Array = lanes[i].ground.mesh.surface_get_arrays(0)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			if vertices.size() != int(w.rows)*int(w.cols):
				printerr("Terrain sample count mismatch")
				quit(1)
				return
			for j in range(vertices.size()):
				if absf(vertices[j].y+bytes.decode_u16(j*3)/1000.0)>0.00001:
					printerr("Terrain height differs from authoritative excavation")
					quit(1)
					return
			if lanes[i].flow.mesh.get_surface_count()>0:
				var flow_arrays: Array = lanes[i].flow.mesh.surface_get_arrays(0)
				var flow: PackedVector3Array = flow_arrays[Mesh.ARRAY_VERTEX]
				water_vertices += flow.size()
				for point in flow:
					if absf(point.y-float(w.level)-0.006)>0.00001 or absf(point.x)>(int(w.cols)-1)*float(w.size)/2+0.0001:
						printerr("Water surface does not follow the shared level or terrain bounds")
						quit(1)
						return
		if water_vertices == 0:
			printerr("Continuous water mesh is missing")
			quit(1)
			return
		print("Verified continuous native terrain against all packed height samples; water vertices: ",water_vertices)
	quit(0)
