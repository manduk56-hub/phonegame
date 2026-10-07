extends Node3D

var strength := 0.0
var ribbons: MeshInstance3D
var foam: MultiMeshInstance3D
var water_material: StandardMaterial3D
var funnel: MeshInstance3D
var funnel_material: ShaderMaterial

func _init() -> void:
	ribbons = MeshInstance3D.new()
	water_material = StandardMaterial3D.new()
	water_material.albedo_color = Color(.35,.85,1,.3)
	water_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	water_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	water_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	water_material.vertex_color_use_as_albedo = true
	ribbons.material_override = water_material
	add_child(ribbons)
	funnel = MeshInstance3D.new()
	var sheet := SurfaceTool.new()
	sheet.begin(Mesh.PRIMITIVE_TRIANGLES)
	for row in range(16):
		for column in range(48):
			var points: Array[Vector3] = []
			var uvs: Array[Vector2] = []
			for corner in [Vector2(0,0),Vector2(1,0),Vector2(0,1),Vector2(1,1)]:
				var u: float = (row+corner.y)/16.0
				var v: float = (column+corner.x)/48.0
				var radius := .25+7.5*pow(u,1.15)
				points.append(Vector3(cos(v*TAU)*radius,sin(v*TAU)*radius*.62,3.5+u*12))
				uvs.append(Vector2(v,u))
			for index in [0,1,2,2,1,3]:
				sheet.set_uv(uvs[index])
				sheet.add_vertex(points[index])
	funnel.mesh = sheet.commit()
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
uniform float strength = 0.0;
void fragment() {
 float flow = 0.5+0.5*sin(UV.x*18.84956-UV.y*14.13717+TIME*3.5);
 ALBEDO = mix(vec3(0.15,0.55,0.8),vec3(0.5,0.9,1.0),flow);
 ALPHA = strength*(0.04+flow*0.07)*sin(UV.y*3.14159);
}
"""
	funnel_material = ShaderMaterial.new()
	funnel_material.shader = shader
	funnel.material_override = funnel_material
	add_child(funnel)
	foam = MultiMeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(.11,.11,.24)
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(.7,.95,1)
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.material = material
	foam.multimesh = MultiMesh.new()
	foam.multimesh.transform_format = MultiMesh.TRANSFORM_3D
	foam.multimesh.mesh = mesh
	foam.multimesh.instance_count = 72
	add_child(foam)
	visible = false

func point(u: float, arm: float, time: float, angle: float) -> Vector3:
	var radius := .25+7.5*pow(u,1.15)
	var spin := arm*TAU/3+u*TAU*2.25-time*3.5
	return Vector3(cos(spin)*radius,-.7-sin(angle)*3.5+sin(spin)*radius*.62,3.5+u*12)

func animate(time: float, opening: float, active: bool, delta: float, angle: float) -> void:
	strength = lerpf(strength,opening if active else 0.0,1-exp(-14*delta))
	visible = strength > .025
	if not visible:
		return
	water_material.albedo_color.a = strength*.32
	funnel.position.y = -.7-sin(angle)*3.5
	funnel_material.set_shader_parameter("strength",strength)
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for arm in range(3):
		for i in range(72):
			var vertices: Array[Vector3] = []
			for step in [i,i+1]:
				var u: float = float(step)/72
				var center := point(u,arm,time,angle)
				var radial := Vector3(center.x,center.y+.7+sin(angle)*3.5,0).normalized()
				var width := (.12+.23*u)*strength
				vertices.append(center-radial*width)
				vertices.append(center+radial*width)
			for index in [0,1,2,2,1,3]:
				surface.set_color(Color(.5,.9,1,.4+.6*sin(PI*(float(i)+.5)/72)))
				surface.add_vertex(vertices[index])
	ribbons.mesh = surface.commit()
	for i in range(72):
		var u := fposmod(float(i)/72-time*.42,1.0)
		var pos := point(u,float(i%3),time,angle)
		var next := point(maxf(0,u-.015),float(i%3),time,angle)
		var transform := Transform3D(Basis.IDENTITY,pos)
		transform = transform.looking_at(next,Vector3.UP)
		transform.basis = transform.basis.scaled(Vector3.ONE*strength*sin(PI*u))
		foam.multimesh.set_instance_transform(i,transform)
