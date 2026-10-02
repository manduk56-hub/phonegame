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
    float blades = grain(floor(surface_position.xz * 12.0));
    float patches = grain(floor(surface_position.xz * 0.35));
    ALBEDO = vec3(0.24, 0.40, 0.15) * (0.87 + blades * 0.2 + patches * 0.16);
    ROUGHNESS = 1.0;
}
