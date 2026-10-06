extends SceneTree

func sample_model(path: String, width: int, world_width: float, kind: String) -> Array:
	var image := Image.load_from_file(path)
	var h := roundi(width*float(image.get_height())/image.get_width())
	image.resize(width,h,Image.INTERPOLATE_NEAREST)
	var parts := []
	var cell := world_width/width
	for y in range(h):
		for x in range(width):
			var c := image.get_pixel(x,y)
			if c.a < .4 or (kind == "whale" and c.b < .12) or (kind == "krill" and (c.r < .5 or c.r-c.g < .12)):
				continue
			# Quantize away reference glow: keep the lit shell and original pixel palette.
			var px := (x-width*.5)*cell
			var py := (h*.5-y)*cell
			var depth := cell*1.7 if kind == "krill" else cell*2+sqrt(maxf(0,1-pow(px/(world_width*.51),2)))*1.8
			parts.append({"size":[cell*1.02,cell*1.02,depth],"pos":[px,py,0],"color":"#"+c.to_html(false),"rotation":[0,0,0],"name":"jaw" if kind == "whale" and y > h*.60 and x > width*.24 and x < width*.76 else "body"})
	return parts

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var whale := sample_model(args[0],76,32,"whale")
	var krill := sample_model(args[1],52,1.35,"krill")
	for x in [-.21,-.06]:
		krill.append({"size":[.065,.072,.05],"pos":[x,-.025,.05],"color":"#19202c","rotation":[0,0,0],"name":"eye"})
		krill.append({"size":[.019,.022,.014],"pos":[x-.006,-.013,.08],"color":"#fff5d6","rotation":[0,0,0],"name":"eye"})
	var file := FileAccess.open("res://krill-models.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"whale":whale,"krill":krill}))
	print("Reference models: ",whale.size()," whale blocks, ",krill.size()," krill blocks")
	quit()
