#version 150
//#extension GL_ARB_shading_language_420pack : require
#extension GL_ARB_explicit_attrib_location : require

#define TASK 10
#define ENABLE_OPACITY_CORRECTION 0
#define ENABLE_LIGHTNING 0
#define ENABLE_SHADOWING 0
#define PI 3.1415926535897932384626433832795

in vec3 ray_entry_position;

layout(location = 0) out vec4 FragColor;

uniform mat4 Modelview;

uniform sampler3D volume_texture;
uniform sampler2D transfer_texture;


uniform vec3    camera_location;
uniform float   sampling_distance;
uniform float   sampling_distance_ref;
uniform float   iso_value;
uniform vec3    max_bounds;
uniform ivec3   volume_dimensions;

uniform vec3    light_position;
uniform vec3    light_ambient_color;
uniform vec3    light_diffuse_color;
uniform vec3    light_specular_color;
uniform float   light_ref_coef;




bool
inside_volume_bounds(const in vec3 sampling_position)
{
    return (   all(greaterThanEqual(sampling_position, vec3(0.0)))
            && all(lessThanEqual(sampling_position, max_bounds)));
}


float
get_sample_data(vec3 in_sampling_pos)
{
    vec3 obj_to_tex = vec3(1.0) / max_bounds;
    return texture(volume_texture, in_sampling_pos * obj_to_tex).r;

}

// Task 2.1
// Calculating the central difference
vec3
get_gradient(vec3 sample_pos)
{

    float x = sample_pos.x;
    float y = sample_pos.y;
    float z = sample_pos.z;

    float gradient_x = get_sample_data(vec3(x+1,y,z)) - get_sample_data(vec3(x-1,y,z));
    float gradient_y = get_sample_data(vec3(x,y+1,z)) - get_sample_data(vec3(x,y-1,z));
    float gradient_z = get_sample_data(vec3(x,y,z+1)) - get_sample_data(vec3(x,y,z-1));

    return vec3(gradient_x, gradient_y, gradient_y);

}

// Task 2.2
// Determine the surface normal for the found intersection point 
// and calculate a basic illumination for the iso-surface. 
// 
// Hint: Color-code and visualize your normals to make sure they are correct. 
//       A simple phong shading model suffices

vec3 phong_model(vec3 sample_pos)
{
    // https://de.wikipedia.org/wiki/Normalenvektor
    // http://www.cs.utexas.edu/~bajaj/graphics2012/cs354/lectures/lect14.pdf
    vec3 normal = normalize(get_gradient(sample_pos));

    vec3 light = normalize(sample_pos - light_position);
    vec3 eye = normalize(camera_location- sample_pos);

    // calculating the refelction vector
    // https://en.wikipedia.org/wiki/Phong_reflection_model 
    // https://de.wikipedia.org/wiki/Phong-Beleuchtungsmodell  
    vec3 reflection = 2 * dot(light,normal)* (normal-light);


    // k_d + k_s <=1, k_a <= 1
    // 
    // specular reflection constant, the ratio of reflection of the specular term of incoming light,
    float k_s = 0.1;

    // diffuse reflection constant, the ratio of reflection of the diffuse term of incoming light
    float k_d = 0.45;

    // ambient reflection constant, the ratio of reflection of the ambient term 
    // present in all points in the scene rendered
    float k_a = 0.1;



    //shininess constant for this material, which is larger for surfaces that are smoother and more mirror-like. 
    //When this constant is large the specular highlight is small.
    //
    float alpha = 50.0;

    vec3 phong_value = light_ambient_color * k_a + light_ref_coef *(k_d * dot(light,normal) 
                        + k_s  * ((alpha+2)/(2*PI))* pow(dot(reflection,eye),alpha));

    return phong_value;
}


void main()
{
    /// One step through the volume
    vec3 ray_increment      = normalize(ray_entry_position - camera_location) * sampling_distance;
    /// Position in Volume
    vec3 sampling_pos       = ray_entry_position + ray_increment; // test, increment just to be sure we are in the volume

    /// Init color of fragment
    vec4 dst = vec4(0.0, 0.0, 0.0, 0.0); // rgba , a = alpha (0% = transparent, 100% = full opaque)

    /// check if we are inside volume
    bool inside_volume = inside_volume_bounds(sampling_pos);
    
    if (!inside_volume)
        discard;

#if TASK == 10
    vec4 max_val = vec4(0.0, 0.0, 0.0, 0.0);
    
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume) 
    {      
        // get sample
        float s = get_sample_data(sampling_pos);
                
        // apply the transfer functions to retrieve color and opacity
        vec4 color = texture(transfer_texture, vec2(s, s));
           
        // this is the example for maximum intensity projection
        max_val.r = max(color.r, max_val.r);
        max_val.g = max(color.g, max_val.g);
        max_val.b = max(color.b, max_val.b);
        max_val.a = max(color.a, max_val.a);
        
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }

    dst = max_val;
#endif 
    
#if TASK == 11

    vec4 val = vec4(0.0, 0.0, 0.0, 0.0);
    int count = 0;
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {      
        // get sample
        float s = get_sample_data(sampling_pos);

         // apply the transfer functions to retrieve color and opacity
        vec4 color = texture(transfer_texture, vec2(s, s));


         // mean intensity projection
        val.r += color.r;
        val.g += color.g;
        val.b += color.b;
        val.a += color.a;

        count++;
        
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }

    val.r = val.r/count;
    val.g = val.g/count;
    val.b = val.b/count;
    val.a = val.a/count;

     dst = val;



#endif
    
#if TASK == 12 || TASK == 13

     vec4 val = vec4(0.0, 0.0, 0.0, 0.0);
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {
        // get sample
        float s = get_sample_data(sampling_pos);

        // dummy code
        //dst = vec4(light_diffuse_color, 1.0);

         // apply the transfer functions to retrieve color and opacity
         vec4 color = texture(transfer_texture, vec2(s, s));
        
         // first hit
         // 
         if(s >= iso_value){   

            val.r = color.r;
            val.g = color.g;
            val.b = color.b;
            val.a = color.a;
         }

        // increment the ray sampling position
        sampling_pos += ray_increment;


#if TASK == 13 // Binary Search
        IMPLEMENT;
#endif
#if ENABLE_LIGHTNING == 1 // Add Shading
        IMPLEMENTLIGHT;
#if ENABLE_SHADOWING == 1 // Add Shadows
        IMPLEMENTSHADOW;
#endif
#endif

        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
    dst = val;
#endif 

#if TASK == 31
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {
        // get sample
#if ENABLE_OPACITY_CORRECTION == 1 // Opacity Correction
        IMPLEMENT;
#else
        float s = get_sample_data(sampling_pos);
#endif
        // dummy code
        dst = vec4(light_specular_color, 1.0);

        // increment the ray sampling position
        sampling_pos += ray_increment;

#if ENABLE_LIGHTNING == 1 // Add Shading
        IMPLEMENT;
#endif

        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 

    // return the calculated color value
    FragColor = dst;
}

