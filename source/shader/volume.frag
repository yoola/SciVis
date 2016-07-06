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
// the d tilda
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

    float toadd_x = max_bounds.x / volume_dimensions.x;
    float toadd_y = max_bounds.y / volume_dimensions.y;
    float toadd_z = max_bounds.z / volume_dimensions.z;

    float gradient_x = get_sample_data(vec3(x+toadd_x,y,z)) - get_sample_data(vec3(x-toadd_x,y,z));
    float gradient_y = get_sample_data(vec3(x,y+toadd_y,z)) - get_sample_data(vec3(x,y-toadd_y,z));
    float gradient_z = get_sample_data(vec3(x,y,z+toadd_z)) - get_sample_data(vec3(x,y,z-toadd_z));

    return vec3(gradient_x, gradient_y, gradient_z);

}

struct
Material
{
    float k_s;
    float k_d;
    float k_a;
    float alpha;
};

// Task 2.2
// Determine the surface normal for the found intersection point 
// and calculate a basic illumination for the iso-surface. 
// 
// Hint: Color-code and visualize your normals to make sure they are correct. 
//       A simple phong shading model suffices

vec4
phong_model(vec3 sample_pos, vec4 color, Material m)
{

    // https://de.wikipedia.org/wiki/Normalenvektor
    // http://www.cs.utexas.edu/~bajaj/graphics2012/cs354/lectures/lect14.pdf
    vec3 normal = normalize(get_gradient(sample_pos));
    vec3 light = normalize(sample_pos - light_position);
    vec3 eye = normalize(camera_location - sample_pos);

    // calculating the refelction vector
    // https://en.wikipedia.org/wiki/Phong_reflection_model 
    // https://de.wikipedia.org/wiki/Phong-Beleuchtungsmodell  
    vec3 reflection = 2 * dot(light,normal)* (normal-light);

    // k_d + k_s <=1, k_a <= 1
    // 
    // specular reflection constant, the ratio of reflection of the specular term of incoming light,
    //m.k_s = 0.1;

    // diffuse reflection constant, the ratio of reflection of the diffuse term of incoming light
    //m.k_d = 0.45;

    // ambient reflection constant, the ratio of reflection of the ambient term 
    // present in all points in the scene rendered
    //m.k_a = 0.1;



    //shininess constant for this material, which is larger for surfaces that are smoother and more mirror-like. 
    //When this constant is large the specular highlight is small.
    //
    m.alpha = 2.0;


    vec3 phong_value = light_ambient_color * m.k_a + 1.0 *(m.k_d * dot(light,normal) 
                        + m.k_s *((m.alpha+2)/2*PI) * pow(dot(reflection, eye),m.alpha));

    //return vec4(normal/2 +0.5,1.0);
    return vec4(phong_value,1.0);
}



vec3
bin_search(vec3 sampling_pos, vec3 ray_increment){

    vec3 prev_sampling = sampling_pos - ray_increment;
    vec3 min = prev_sampling;
    vec3 max = sampling_pos + ray_increment;
    vec3 mid;
    int loop = 0;

    while(length(max-min) > 0.000001 && loop <1000){


        mid = (min+max) *0.5;
        float s_mid = get_sample_data(mid);

        if(s_mid == iso_value){
            break;
        }
        if(s_mid > iso_value){

            max = mid;
        }else{

            min = mid;
        }
        loop++;
    }

    return mid;

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
    
    float s = get_sample_data(sampling_pos);
    vec4 color = texture(transfer_texture, vec2(s, s));

    while (inside_volume) 
    {      
        // get sample
        s = get_sample_data(sampling_pos);
                
        // apply the transfer functions to retrieve color and opacity
        color = texture(transfer_texture, vec2(s, s));

        //color = phong_model(sampling_pos, color);

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
    float prev_s = 0.0;
    float s = 0.0;
    Material m;
    float bin_search_iso_value = 0.0;

     //bool shadow = false;
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added

    

    while (inside_volume)
    {
        // get sample
        s = get_sample_data(sampling_pos);

        //shadow = false;

        // dummy code
        //dst = vec4(light_diffuse_color, 1.0);

         // apply the transfer functions to retrieve color and opacity
         vec4 color = texture(transfer_texture, vec2(s, s));
        
         // first hit
         // if the sign value changes, we hit a surface
         if ( sign(s - iso_value) != sign(prev_s - iso_value) ){ 

            //shadow = true;

            val.r = color.r;
            val.g = color.g;
            val.b = color.b;
            val.a = color.a;

            prev_s = s;

            #if TASK == 13 // Binary Search
                sampling_pos = bin_search(sampling_pos, ray_increment);
                s = get_sample_data(sampling_pos);

                val = texture(transfer_texture, vec2(s, s));

                bin_search_iso_value = iso_value;
                //val = vec4(0.5,0.5,0.5,1.0);
            #endif
						
            #if ENABLE_LIGHTNING == 1 // Add Shading
                m.k_s = 0.1;
                m.k_d = 0.45;
                m.k_a = 0.1;

                val = phong_model(sampling_pos,val,m);
            #endif

            #if ENABLE_SHADOWING == 1 // Add Shadows
            
            vec3 light_increment = 0.0001f* normalize(sampling_pos - light_position);
            vec3 light_direction = sampling_pos + light_increment;
            

            while(inside_volume){

                  // increment the ray sampling position
                s = get_sample_data(light_direction);

                 light_direction += light_increment;

                 if(s > iso_value){

                    val = val *0.5;
                    break;
                 }


                // update the loop termination condition
                inside_volume = inside_volume_bounds(light_direction);
            }
            
            #endif


            break;
          
         }


        

            

        // increment the ray sampling position
        sampling_pos += ray_increment;

        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
		
    dst = val;
#endif 


#if TASK == 31
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    // 
		
		// mode 0 is Front to Back
		// mode 1 is Back to Front
		int mode = 1;
        Material m;
        m.k_s = 0.1;
        m.k_d = 0.45;
        m.k_a = 0.1;
		
		dst = vec4(light_specular_color, 1.0);
		
		if ( mode == 0 ){
			float trans = 1.0;
			vec3 inten = vec3(0.0, 0.0,0.0);
			vec4 prev_color = vec4(0.0,0.0,0.0,0.0);
			float s = 0;

			while (inside_volume && trans >= 0.00001)
			{   
					s = get_sample_data(sampling_pos);
					vec4 color = texture(transfer_texture, vec2(s, s));
				
					trans = trans * (1 - prev_color.a);
					inten = inten + trans * color.rgb * color.a;

					prev_color = color;

                    #if ENABLE_LIGHTNING == 1 // Add Shading
                        color = phong_model(sampling_pos,color,m);
                    #endif
					
					// get sample
					#if ENABLE_OPACITY_CORRECTION == 1 // Opacity Correction
                        color.a = 1 - pow ( (1- color.a), (sampling_distance/sampling_distance_ref )*250);
					#endif
					

					// increment the ray sampling position
					sampling_pos += ray_increment;

					

					// update the loop termination condition
					inside_volume = inside_volume_bounds(sampling_pos);
			}
			
			dst = vec4(inten,1.0);
		}
		
		else{
		
			float trans = 1.0;
			vec3 inten = vec3(0.0, 0.0,0.0);
			vec4 prev_color = vec4(0.0,0.0,0.0,0.0);
			float s = 0;

			while (inside_volume)
			{
					// increment the ray sampling position
					sampling_pos += ray_increment;

					// update the loop termination condition
					inside_volume = inside_volume_bounds(sampling_pos);
			}
			
			// Get back in the last position in the volume
			sampling_pos -= ray_increment;
			inside_volume = inside_volume_bounds(sampling_pos);
			
			while (inside_volume){
				s = get_sample_data(sampling_pos);
				vec4 color = texture(transfer_texture, vec2(s, s));

                #if ENABLE_LIGHTNING == 1 // Add Shading
                    color = phong_model(sampling_pos,color,m);
                    
                #endif
				
				#if ENABLE_OPACITY_CORRECTION == 1 // Opacity Correction
					color.a = 1 - pow ( (1- color.a), (sampling_distance/sampling_distance_ref )*250);
				#endif
				
				inten = (color.rgb * color.a) + ( inten * (1-color.a) );
				
				// decrement the ray sampling position
				sampling_pos -= ray_increment;

				

				// update the loop termination condition
				inside_volume = inside_volume_bounds(sampling_pos);
			}
			
			
			dst = vec4(inten,1.0);
		}
		
#endif 

    // return the calculated color value
    
    FragColor = dst;
}