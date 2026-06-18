/*
N trimming rounds can be performed with the following:
Trimming round 1: clear nodes bitmap, step one, step two
Trimming round 2: clear nodes bitmap, step three, step four
Trimming round 3: clear nodes bitmap, step three, step four
...
Trimming round n - 1: clear nodes bitmap, step three, step four
Trimming round n: clear nodes bitmap, step three, step five
Get result from remaining edges
*/


// Constants

// Bits in a u32
const BITS_IN_A_U32: u32 = 32u;

// Node mask
const NODE_MASK: u32 = 0xFFFFFFFFu >> (BITS_IN_A_U32 - EDGE_BITS);

// SipRound rotation
const SIP_ROUND_ROTATION: u32 = 21u;


// Structures

// SipHash keys structure
struct SipHashKeys {

	// X
	x: vec2<u32>,
	
	// Y
	y: vec2<u32>,
	
	// Z
	z: vec2<u32>,
	
	// W
	w: vec2<u32>
};


// Bindings

// Nodes bitmap
@group(0) @binding(0) var<storage, read_write> nodesBitmap: array<u32>;
@group(0) @binding(0) var<storage, read_write> nodesBitmapAtomic: array<atomic<u32>>;

// Edges bitmap
@group(0) @binding(1) var<storage, read_write> edgesBitmap: array<u32>;

// Remaining edges
@group(0) @binding(2) var<storage, read_write> remainingEdges: array<atomic<u32>>;

// SipHash keys
@group(0) @binding(3) var<uniform> sipHashKeys: SipHashKeys;

// Nodes in second partition
@group(0) @binding(4) var<uniform> nodesInSecondPartition: u32;

// Starting index
@group(0) @binding(5) var<uniform> startingIndex: u32;


// Supporting function implementation

// Trim edges step one
@compute @workgroup_size(TRIM_EDGES_STEP_ONE_WORK_ITEMS_PER_WORK_GROUP_X, TRIM_EDGES_STEP_ONE_WORK_ITEMS_PER_WORK_GROUP_Y) fn trimEdgesStepOne(@builtin(global_invocation_id) global_invocation_id: vec3<u32>, @builtin(num_workgroups) num_workgroups: vec3<u32>) {

	// Get global ID
	let globalId: u32 = startingIndex + global_invocation_id.x + global_invocation_id.y * TRIM_EDGES_STEP_ONE_WORK_ITEMS_PER_WORK_GROUP_X * num_workgroups.x;
	
	// Get work item's edge indices
	let indices: u32 = globalId * NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM;
	
	// Go through all of this work item's edges
	for(var i: u32 = 0u; i < NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM; i++) {
	
		// Get edge's index
		let edgeIndex: u32 = indices + i;
		
		// Get edge's node
		let node: u32 = sipHash24(vec2<u32>(edgeIndex * 2u, edgeIndex >> (BITS_IN_A_U32 - 1u)));
		
		// Enable node in nodes bitmap
		setBitInNodesBitmap(node);
	}
}

// Trim edges step two
@compute @workgroup_size(TRIM_EDGES_STEP_TWO_WORK_ITEMS_PER_WORK_GROUP_X, TRIM_EDGES_STEP_TWO_WORK_ITEMS_PER_WORK_GROUP_Y) fn trimEdgesStepTwo(@builtin(global_invocation_id) global_invocation_id: vec3<u32>, @builtin(num_workgroups) num_workgroups: vec3<u32>) {

	// Get global ID
	let globalId: u32 = startingIndex + global_invocation_id.x + global_invocation_id.y * TRIM_EDGES_STEP_TWO_WORK_ITEMS_PER_WORK_GROUP_X * num_workgroups.x;
	
	// Get work item's edge indices
	let indices: u32 = globalId * BITS_IN_A_U32;
	
	// Set edges to zero
	var edges: u32 = 0u;
	
	// Go through all of this work item's edges
	for(var i: u32 = 0u; i < BITS_IN_A_U32; i++) {
	
		// Get edge's index
		let edgeIndex: u32 = indices + i;
		
		// Get edge's node
		let node: u32 = sipHash24(vec2<u32>(edgeIndex * 2u, edgeIndex >> (BITS_IN_A_U32 - 1u)));
		
		// Check if node has a pair in the nodes bitmap
		if(isBitSetInNodesBitmap(node ^ 1u)) {
		
			// Enable edge
			edges |= 1u << i;
		}
	}
	
	// Set edges in edges bitmap
	edgesBitmap[globalId] = edges;
}

// Trim edges step three
@compute @workgroup_size(TRIM_EDGES_STEP_THREE_WORK_ITEMS_PER_WORK_GROUP_X, TRIM_EDGES_STEP_THREE_WORK_ITEMS_PER_WORK_GROUP_Y) fn trimEdgesStepThree(@builtin(global_invocation_id) global_invocation_id: vec3<u32>, @builtin(num_workgroups) num_workgroups: vec3<u32>) {

	// Get global ID
	let globalId: u32 = startingIndex + global_invocation_id.x + global_invocation_id.y * TRIM_EDGES_STEP_THREE_WORK_ITEMS_PER_WORK_GROUP_X * num_workgroups.x;
	
	// Get work item's edge indices
	let indices: u32 = globalId * BITS_IN_A_U32;
	
	// Get this work item's edges
	var edges: u32 = edgesBitmap[globalId];
	
	// Go through all of this work item's enabled edges
	for(var i: u32 = countTrailingZeros(edges); i != BITS_IN_A_U32; i = countTrailingZeros(edges)) {
	
		// Get edge's index
		let edgeIndex: u32 = indices + i;
		
		// Get edge's node
		let node: u32 = sipHash24(vec2<u32>((edgeIndex * 2u) | nodesInSecondPartition, edgeIndex >> (BITS_IN_A_U32 - 1u)));
		
		// Enable node in nodes bitmap
		setBitInNodesBitmap(node);
		
		// Set that edge was processed
		edges ^= 1u << i;
	}
}

// Trim edges step four
@compute @workgroup_size(TRIM_EDGES_STEP_FOUR_WORK_ITEMS_PER_WORK_GROUP_X, TRIM_EDGES_STEP_FOUR_WORK_ITEMS_PER_WORK_GROUP_Y) fn trimEdgesStepFour(@builtin(global_invocation_id) global_invocation_id: vec3<u32>, @builtin(num_workgroups) num_workgroups: vec3<u32>) {

	// Get global ID
	let globalId: u32 = startingIndex + global_invocation_id.x + global_invocation_id.y * TRIM_EDGES_STEP_FOUR_WORK_ITEMS_PER_WORK_GROUP_X * num_workgroups.x;
	
	// Get work item's edge indices
	let indices: u32 = globalId * BITS_IN_A_U32;
	
	// Get this work item's edges
	var edges: u32 = edgesBitmap[globalId];
	
	// Go through all of this work item's enabled edges
	var remainingEdges: u32 = edges;
	for(var i: u32 = countTrailingZeros(remainingEdges); i != BITS_IN_A_U32; i = countTrailingZeros(remainingEdges)) {
	
		// Get edge's index
		let edgeIndex: u32 = indices + i;
		
		// Get edge's node
		let node: u32 = sipHash24(vec2<u32>((edgeIndex * 2u) | nodesInSecondPartition, edgeIndex >> (BITS_IN_A_U32 - 1u)));
		
		// Check if node doesn't have a pair in the nodes bitmap
		if(!isBitSetInNodesBitmap(node ^ 1u)) {
		
			// Disable edge
			edges ^= 1u << (edgeIndex % BITS_IN_A_U32);
		}
		
		// Set that edge was processed
		remainingEdges ^= 1u << i;
	}
	
	// Set edges in edges bitmap
	edgesBitmap[globalId] = edges;
}

// Trim edges step five
@compute @workgroup_size(TRIM_EDGES_STEP_FIVE_WORK_ITEMS_PER_WORK_GROUP_X, TRIM_EDGES_STEP_FIVE_WORK_ITEMS_PER_WORK_GROUP_Y) fn trimEdgesStepFive(@builtin(global_invocation_id) global_invocation_id: vec3<u32>, @builtin(num_workgroups) num_workgroups: vec3<u32>) {

	// Get global ID
	let globalId: u32 = startingIndex + global_invocation_id.x + global_invocation_id.y * TRIM_EDGES_STEP_FIVE_WORK_ITEMS_PER_WORK_GROUP_X * num_workgroups.x;
	
	// Get work item's edge indices
	let indices: u32 = globalId * BITS_IN_A_U32;
	
	// Get this work item's edges
	var edges: u32 = edgesBitmap[globalId];
	
	// Go through all of this work item's enabled edges
	for(var i: u32 = countTrailingZeros(edges); i != BITS_IN_A_U32; i = countTrailingZeros(edges)) {
	
		// Get edge's index
		let edgeIndex: u32 = indices + i;
		
		// Get edge's node
		let node: u32 = sipHash24(vec2<u32>((edgeIndex * 2u) | nodesInSecondPartition, edgeIndex >> (BITS_IN_A_U32 - 1u)));
		
		// Check if node has a pair in the nodes bitmap
		if(isBitSetInNodesBitmap(node ^ 1u)) {
		
			// Get edge's other node
			let otherNode: u32 = sipHash24(vec2<u32>((edgeIndex * 2u) | (1u - nodesInSecondPartition), edgeIndex >> (BITS_IN_A_U32 - 1u)));
			
			// Get next remaining edge index
			let nextRemainingEdgeIndex: u32 = min(atomicAdd(&remainingEdges[0], 1u), MAX_NUMBER_OF_EDGES_AFTER_TRIMMING - 1u) * EDGE_NUMBER_OF_COMPONENTS + 1u;
			
			// Check if trimming rounds is even
			if(TRIMMING_ROUNDS % 2u == 0u) {
			
				// Set next remaining edge to the edge and its nodes
				atomicStore(&remainingEdges[nextRemainingEdgeIndex], edgeIndex);
				atomicStore(&remainingEdges[nextRemainingEdgeIndex + 1u], otherNode);
				atomicStore(&remainingEdges[nextRemainingEdgeIndex + 2u], node);
			}
			
			// Otherwise
			else {
			
				// Set next remaining edge to the edge and its nodes
				atomicStore(&remainingEdges[nextRemainingEdgeIndex], edgeIndex);
				atomicStore(&remainingEdges[nextRemainingEdgeIndex + 1u], node);
				atomicStore(&remainingEdges[nextRemainingEdgeIndex + 2u], otherNode);
			}
		}
		
		// Set that edge was processed
		edges ^= 1u << i;
	}
}

// SipHash-2-4
@must_use fn sipHash24(nonce: vec2<u32>) -> u32 {

	// Set keys to SipHash keys
	var keys: SipHashKeys = sipHashKeys;
	
	// Perform hash on keys
	keys.w ^= nonce;
	sipRound(&keys);
	sipRound(&keys);
	keys.x ^= nonce;
	keys.z[0] ^= 255u;
	sipRound(&keys);
	sipRound(&keys);
	sipRound(&keys);
	keys.x += keys.y;
	keys.x[1] += u32(keys.x[0] < keys.y[0]);
	keys.z += keys.w;
	keys.z[1] += u32(keys.z[0] < keys.w[0]);
	keys.y = (keys.y << vec2<u32>(13u)) | (keys.y.yx >> vec2<u32>(BITS_IN_A_U32 - 13u));
	keys.w = (keys.w << vec2<u32>(16u)) | (keys.w.yx >> vec2<u32>(BITS_IN_A_U32 - 16u));
	keys.y ^= keys.x;
	keys.w ^= keys.z;
	keys.z += keys.y;
	keys.z[1] += u32(keys.z[0] < keys.y[0]);
	keys.y[0] = (keys.y[0] << 17u) | (keys.y[1] >> (BITS_IN_A_U32 - 17u));
	keys.w[0] = (keys.w[0] << SIP_ROUND_ROTATION) | (keys.w[1] >> (BITS_IN_A_U32 - SIP_ROUND_ROTATION));
	
	// Check if edge bits is 32
	if(EDGE_BITS == 32u) {
	
		// Return node from keys
		return keys.y[0] ^ keys.z[0] ^ keys.z[1] ^ keys.w[0];
	}
	
	// Otherwise
	else {
	
		// Return node from keys
		return (keys.y[0] ^ keys.z[0] ^ keys.z[1] ^ keys.w[0]) & NODE_MASK;
	}
}

// SipRound
fn sipRound(keys: ptr<function, SipHashKeys>) {

	// Perform SipRound on keys
	keys.x += keys.y;
	keys.x[1] += u32(keys.x[0] < keys.y[0]);
	keys.z += keys.w;
	keys.z[1] += u32(keys.z[0] < keys.w[0]);
	keys.y = (keys.y << vec2<u32>(13u)) | (keys.y.yx >> vec2<u32>(BITS_IN_A_U32 - 13u));
	keys.w = (keys.w << vec2<u32>(16u)) | (keys.w.yx >> vec2<u32>(BITS_IN_A_U32 - 16u));
	keys.y ^= keys.x;
	keys.w ^= keys.z;
	keys.x = keys.x.yx;
	keys.x += keys.w;
	keys.x[1] += u32(keys.x[0] < keys.w[0]);
	keys.z += keys.y;
	keys.z[1] += u32(keys.z[0] < keys.y[0]);
	keys.y = (keys.y << vec2<u32>(17u)) | (keys.y.yx >> vec2<u32>(BITS_IN_A_U32 - 17u));
	keys.w = (keys.w << vec2<u32>(SIP_ROUND_ROTATION)) | (keys.w.yx >> vec2<u32>(BITS_IN_A_U32 - SIP_ROUND_ROTATION));
	keys.y ^= keys.z;
	keys.w ^= keys.x;
	keys.z = keys.z.yx;
}

// Set bit in nodes bitmap
fn setBitInNodesBitmap(index: u32) {

	// Set bit in nodes bitmap
	atomicOr(&nodesBitmapAtomic[index / BITS_IN_A_U32], 1u << (index % BITS_IN_A_U32)); 
}

// Is bit set in nodes bitmap
@must_use fn isBitSetInNodesBitmap(index: u32) -> bool {

	// Return if bit is set in nodes bitmap
	return (nodesBitmap[index / BITS_IN_A_U32] & (1u << (index % BITS_IN_A_U32))) != 0u;
}
