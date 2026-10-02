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
		var actual: Vector3 = world.machines[p.id].bucket.to_global(Vector3(0,-0.02,-0.6))
		var expected := Vector3(p.bucket.x,p.bucket.height,p.bucket.z)
		var error := actual.distance_to(expected)
		maximum_error = maxf(maximum_error,error)
		if error > 0.0001:
			printerr("Bucket geometry mismatch for ",p.name,": ",error)
			quit(1)
			return
	print("Verified ",fixture.players.size()," rendered bucket poses against authoritative simulation. Maximum error: ",maximum_error)
	quit(0)
