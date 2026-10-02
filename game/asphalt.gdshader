shader_type spatial;
render_mode diffuse_burley;

varying vec3 surface_position;

float grain(vec2 cell) {
    return fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
}

void vertex() {
    surface_position = VERTEX;
}

void fragment() {
    float aggregate = grain(floor(surface_position.xz * 18.0));
    float wear = grain(floor(surface_position.xz * 0.6));
    ALBEDO = vec3(0.19, 0.205, 0.225) * (0.88 + aggregate * 0.24 + wear * 0.08);
    ROUGHNESS = 0.96;
}
