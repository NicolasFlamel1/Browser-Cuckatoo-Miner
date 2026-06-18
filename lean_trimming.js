// Use strict
"use strict";


// Configurable constants

// Lean trimming number of edges per step one work item
const LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM = 64;

// Lean trimming number of parts per step
const LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP = (IS_MOBILE === true) ? 256 : 32;

// Lean trimming number of step parts before waiting
const LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING = 4;


// Main function

// Try
try {

	// Check if lean trimming number of edges per step one work item is invalid
	if(Number.isInteger(LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM) === false || Math.log2(LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM) % 1 !== 0 || LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM > NUMBER_OF_EDGES || NUMBER_OF_EDGES / LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM > UINT32_MAX || LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM > UINT32_MAX) {
	
		// Throw exception
		throw new Error("Trimming number of edges per step one work item is invalid");
	}
	
	// Check if lean trimming number of parts per step is invalid
	if(Number.isInteger(LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP) === false || Math.log2(LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP) % 1 !== 0 || LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP > NUMBER_OF_EDGES / LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM || LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP > NUMBER_OF_EDGES / (Uint32Array.BYTES_PER_ELEMENT * BITS_IN_A_BYTE)) {
	
		// Throw exception
		throw new Error("Trimming number of edges per step one work item is invalid");
	}
	
	// Check if lean trimming number step parts before waiting is invalid
	if(Number.isInteger(LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING) === false || LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING < 0 || (LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING !== 0 && LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP % LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING !== 0)) {
	
		// Throw exception
		throw new Error("Trimming number of edges per step one work item is invalid");
	}
	
	// Check if trimming rounds is invalid
	if(TRIMMING_ROUNDS < 2 || (MAX_NUMBER_OF_EDGES_AFTER_TRIMMING - 1) * EDGE_NUMBER_OF_COMPONENTS + 1 > UINT32_MAX) {
	
		// Throw exception
		throw new Error("Trimming rounds is invalid");
	}
}

// Catch errors
catch(error) {

	// Log error's message
	console.log(error.message);
	
	// Rethrow error
	throw error;
}


// Classes

// Lean trimming class
class LeanTrimming {

	// Public
	
		// Initialize
		async initialize() {
		
			// Check if WebGPU isn't supported
			if("gpu" in navigator === false || navigator.gpu === null) {
			
				// Throw exception
				throw new Error("Your browser doesn't support WebGPU");
			}
			
			// Display message
			console.log("Requesting " + ((REQUEST_HIGH_PERFORMANCE_GPU === true) ? "high performance" : "low power") + " adapter");
			
			// Request adapter
			const adapter = await navigator.gpu.requestAdapter({
			
				// Compatibility mode
				featureLevel: "compatibility",
				
				// Power preference
				powerPreference: (REQUEST_HIGH_PERFORMANCE_GPU === true) ? "high-performance" : "low-power"
			});
			
			// Check if no adapter is available
			if(adapter === null) {
			
				// Throw exception
				throw new Error("No adapter is available");
			}
			
			// Display message
			console.log("Got " + ((adapter.info.vendor === "") ? "" : adapter.info.vendor + " ") + "adapter");
			
			// Check if not using a mobile browser
			if(IS_MOBILE === false) {
			
				// Check if using a Chromium based browser
				if("chrome" in window === true) {
				
					// Display message
					console.log("You can enable your browser's Force High Performance GPU setting at chrome://flags/#force-high-performance-gpu if this miner isn't using your most performant GPU");
				}
				
				// Otherwise check if using Firefox on Windows
				else if(/Firefox/i.test(navigator.userAgent) === true && /Windows/i.test(navigator.userAgent) === true) {
				
					// Display message
					console.log("You can configure your browser to use your most performant GPU by following the instructions at https://learn.microsoft.com/en-us/answers/questions/4160558/how-to-activate-secondary-gpu-when-running-applica#answer-7018154 if this miner isn't using your most performant GPU");
				}
			}
			
			// Display message
			console.log("Requesting device");
			
			// Request device
			this.#device = await adapter.requestDevice({
			
				// Upgrade to core mode if available
				requiredFeatures: (adapter.features.has("core-features-and-limits") === true) ? ["core-features-and-limits"] : [],
				
				// Required limits
				requiredLimits: {
				
					// Max buffer size
					maxBufferSize: Math.max(NUMBER_OF_EDGES / BITS_IN_A_BYTE, Uint32Array.BYTES_PER_ELEMENT + MAX_NUMBER_OF_EDGES_AFTER_TRIMMING * Uint32Array.BYTES_PER_ELEMENT * EDGE_NUMBER_OF_COMPONENTS),
					
					// Max storage buffer binding size
					maxStorageBufferBindingSize: Math.max(NUMBER_OF_EDGES / BITS_IN_A_BYTE, Uint32Array.BYTES_PER_ELEMENT + MAX_NUMBER_OF_EDGES_AFTER_TRIMMING * Uint32Array.BYTES_PER_ELEMENT * EDGE_NUMBER_OF_COMPONENTS)
				}
			});
			
			// Display message
			console.log("Got device");
			
			// Set on device lost
			this.#device.lost.then((info) => {
			
				// Display message
				console.log("Device was lost: " + info.message);
			});
			
			// Set total number of work items based on the kernels and number of parts per step
			this.#totalNumberOfWorkItems = [
			
				// Trim edges step one kernel
				(NUMBER_OF_EDGES / LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM) / LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP,
				
				// Trim edges step two kernel
				(NUMBER_OF_EDGES / (Uint32Array.BYTES_PER_ELEMENT * BITS_IN_A_BYTE)) / LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP,
				
				// Trim edges step three kernel
				(NUMBER_OF_EDGES / (Uint32Array.BYTES_PER_ELEMENT * BITS_IN_A_BYTE)) / LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP,
				
				// Trim edges step four kernel
				(NUMBER_OF_EDGES / (Uint32Array.BYTES_PER_ELEMENT * BITS_IN_A_BYTE)) / LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP,
				
				// Trim edges step five kernel
				(NUMBER_OF_EDGES / (Uint32Array.BYTES_PER_ELEMENT * BITS_IN_A_BYTE)) / LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP
			];
			
			// Set work items per work group based on the total number of work items and max work group size
			const workItemsPerWorkGroup = [
			
				// Trim edges step one kernel
				[Math.min(Math.pow(2, Math.floor(Math.log2(this.#device.limits.maxComputeInvocationsPerWorkgroup))), this.#totalNumberOfWorkItems[0]), 1],
				
				// Trim edges step two kernel
				[Math.min(Math.pow(2, Math.floor(Math.log2(this.#device.limits.maxComputeInvocationsPerWorkgroup))), this.#totalNumberOfWorkItems[1]), 1],
				
				// Trim edges step three kernel
				[Math.min(Math.pow(2, Math.floor(Math.log2(this.#device.limits.maxComputeInvocationsPerWorkgroup))), this.#totalNumberOfWorkItems[2]), 1],
				
				// Trim edges step four kernel
				[Math.min(Math.pow(2, Math.floor(Math.log2(this.#device.limits.maxComputeInvocationsPerWorkgroup))), this.#totalNumberOfWorkItems[3]), 1],
				
				// Trim edges step five kernel
				[Math.min(Math.pow(2, Math.floor(Math.log2(this.#device.limits.maxComputeInvocationsPerWorkgroup))), this.#totalNumberOfWorkItems[4]), 1],
			];
			
			// Get number of work groups based on the total number of work items and the work items per work group
			this.#numberOfWorkGroups = [
			
				// Trim edges step one kernel
				[this.#totalNumberOfWorkItems[0] / workItemsPerWorkGroup[0][0], 1],
				
				// Trim edges step two kernel
				[this.#totalNumberOfWorkItems[1] / workItemsPerWorkGroup[1][0], 1],
				
				// Trim edges step three kernel
				[this.#totalNumberOfWorkItems[2] / workItemsPerWorkGroup[2][0], 1],
				
				// Trim edges step four kernel
				[this.#totalNumberOfWorkItems[3] / workItemsPerWorkGroup[3][0], 1],
				
				// Trim edges step five kernel
				[this.#totalNumberOfWorkItems[4] / workItemsPerWorkGroup[4][0], 1]
			];
			
			// Go through all number of work groups
			for(let i = 0; i < this.#numberOfWorkGroups.length; ++i) {
			
				// Loop while number of work groups in the first dimension exceeds the max work groups per dimension
				while(this.#numberOfWorkGroups[i][0] > this.#device.limits.maxComputeWorkgroupsPerDimension && this.#numberOfWorkGroups[i][0] > 1 && workItemsPerWorkGroup[i][0] > 1) {
				
					// Move work group from the first dimension into the second dimension
					this.#numberOfWorkGroups[i][0] /= 2;
					this.#numberOfWorkGroups[i][1] *= 2;
					workItemsPerWorkGroup[i][0] /= 2;
					workItemsPerWorkGroup[i][1] *= 2;
				}
			}
			
			// Display message
			console.log("Creating shader module");
			
			// Create shader module
			const shaderModule = this.#device.createShaderModule({
			
				// Code
				code: `
					// Configurable constants
					
					// Edge bits
					const EDGE_BITS: u32 = ` + EDGE_BITS.toFixed() + `u;
					
					// Trimming rounds
					const TRIMMING_ROUNDS: u32 = ` + TRIMMING_ROUNDS.toFixed() + `u;
					
					// Max number of edges after trimming 
					const MAX_NUMBER_OF_EDGES_AFTER_TRIMMING: u32 = ` + MAX_NUMBER_OF_EDGES_AFTER_TRIMMING.toFixed() + `u;
					
					// Edge number of components
					const EDGE_NUMBER_OF_COMPONENTS: u32 = ` + EDGE_NUMBER_OF_COMPONENTS.toFixed() + `u;
					
					// Number of edges per step one work item
					const NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM: u32 = ` + LEAN_TRIMMING_NUMBER_OF_EDGES_PER_STEP_ONE_WORK_ITEM.toFixed() + `u;
					
					// Trim edges step one work items per work group
					const TRIM_EDGES_STEP_ONE_WORK_ITEMS_PER_WORK_GROUP_X: u32 = ` + workItemsPerWorkGroup[0][0].toFixed() + `u;
					const TRIM_EDGES_STEP_ONE_WORK_ITEMS_PER_WORK_GROUP_Y: u32 = ` + workItemsPerWorkGroup[0][1].toFixed() + `u;
					
					// Trim edges step two work items per work group
					const TRIM_EDGES_STEP_TWO_WORK_ITEMS_PER_WORK_GROUP_X: u32 = ` + workItemsPerWorkGroup[1][0].toFixed() + `u;
					const TRIM_EDGES_STEP_TWO_WORK_ITEMS_PER_WORK_GROUP_Y: u32 = ` + workItemsPerWorkGroup[1][1].toFixed() + `u;
					
					// Trim edges step three work items per work group
					const TRIM_EDGES_STEP_THREE_WORK_ITEMS_PER_WORK_GROUP_X: u32 = ` + workItemsPerWorkGroup[2][0].toFixed() + `u;
					const TRIM_EDGES_STEP_THREE_WORK_ITEMS_PER_WORK_GROUP_Y: u32 = ` + workItemsPerWorkGroup[2][1].toFixed() + `u;
					
					// Trim edges step four work items per work group
					const TRIM_EDGES_STEP_FOUR_WORK_ITEMS_PER_WORK_GROUP_X: u32 = ` + workItemsPerWorkGroup[3][0].toFixed() + `u;
					const TRIM_EDGES_STEP_FOUR_WORK_ITEMS_PER_WORK_GROUP_Y: u32 = ` + workItemsPerWorkGroup[3][1].toFixed() + `u;
					
					// Trim edges step five work items per work group
					const TRIM_EDGES_STEP_FIVE_WORK_ITEMS_PER_WORK_GROUP_X: u32 = ` + workItemsPerWorkGroup[4][0].toFixed() + `u;
					const TRIM_EDGES_STEP_FIVE_WORK_ITEMS_PER_WORK_GROUP_Y: u32 = ` + workItemsPerWorkGroup[4][1].toFixed() + `u;
					
				` + await(await fetch("lean_trimming.wgsl")).text()
			});
			
			// Check if compilation messages exist
			const compilationMessages = (await shaderModule.getCompilationInfo()).messages;
			if(compilationMessages.length !== 0) {
			
				// Throw compilation messages
				throw new Error(compilationMessages.join("\n"));
			}
			
			// Display message
			console.log("Created shader module");
			
			// Display message
			console.log("Creating pipelines");
			
			// Create bind group layout
			const bindGroupLayout = this.#device.createBindGroupLayout({
			
				// Entries
				entries: [
				
					// Nodes bitmap and nodes bitmap atomic
					{
					
						// Binding
						binding: 0,
						
						// Visibility
						visibility: GPUShaderStage.COMPUTE,
						
						// Buffer
						buffer: {
						
							// Type
							type: "storage",
						}
					},
					
					// Edges bitmap
					{
					
						// Binding
						binding: 1,
						
						// Visibility
						visibility: GPUShaderStage.COMPUTE,
						
						// Buffer
						buffer: {
						
							// Type
							type: "storage",
						}
					},
					
					// Remaining edges
					{
					
						// Binding
						binding: 2,
						
						// Visibility
						visibility: GPUShaderStage.COMPUTE,
						
						// Buffer
						buffer: {
						
							// Type
							type: "storage",
						}
					},
					
					// SipHash keys
					{
					
						// Binding
						binding: 3,
						
						// Visibility
						visibility: GPUShaderStage.COMPUTE,
						
						// Buffer
						buffer: {
						
							// Type
							type: "uniform",
						}
					},
					
					// Nodes in second partition
					{
					
						// Binding
						binding: 4,
						
						// Visibility
						visibility: GPUShaderStage.COMPUTE,
						
						// Buffer
						buffer: {
						
							// Type
							type: "uniform",
						}
					},
					
					// Starting index
					{
					
						// Binding
						binding: 5,
						
						// Visibility
						visibility: GPUShaderStage.COMPUTE,
						
						// Buffer
						buffer: {
						
							// Type
							type: "uniform",
						}
					}
				]
			});
			
			// Create pipeline layout
			const pipelineLayout = this.#device.createPipelineLayout({
			
				// Bind group layouts
				bindGroupLayouts: [
				
					// Bind group layout
					bindGroupLayout
				]
			});
			
			// Create pipelines
			this.#pipelines = [
			
				// Trim edges step one pipeline
				this.#device.createComputePipeline({
				
					// Compute
					compute: {
					
						// Entry point
						entryPoint: "trimEdgesStepOne",
						
						// Module
						module: shaderModule
					},
					
					// Layout
					layout: pipelineLayout
				}),
				
				// Trim edges step two pipeline
				this.#device.createComputePipeline({
				
					// Compute
					compute: {
					
						// Entry point
						entryPoint: "trimEdgesStepTwo",
						
						// Module
						module: shaderModule
					},
					
					// Layout
					layout: pipelineLayout
				}),
				
				// Trim edges step three pipeline
				this.#device.createComputePipeline({
				
					// Compute
					compute: {
					
						// Entry point
						entryPoint: "trimEdgesStepThree",
						
						// Module
						module: shaderModule
					},
					
					// Layout
					layout: pipelineLayout
				}),
				
				// Trim edges step four pipeline
				this.#device.createComputePipeline({
				
					// Compute
					compute: {
					
						// Entry point
						entryPoint: "trimEdgesStepFour",
						
						// Module
						module: shaderModule
					},
					
					// Layout
					layout: pipelineLayout
				}),
				
				// Trim edges step five pipeline
				this.#device.createComputePipeline({
				
					// Compute
					compute: {
					
						// Entry point
						entryPoint: "trimEdgesStepFive",
						
						// Module
						module: shaderModule
					},
					
					// Layout
					layout: pipelineLayout
				})
			];
			
			// Display message
			console.log("Created pipelines");
			
			// Get total memory allocated
			let totalMemoryAllocated = NUMBER_OF_EDGES / BITS_IN_A_BYTE + NUMBER_OF_EDGES / BITS_IN_A_BYTE + Uint32Array.BYTES_PER_ELEMENT + MAX_NUMBER_OF_EDGES_AFTER_TRIMMING * Uint32Array.BYTES_PER_ELEMENT * EDGE_NUMBER_OF_COMPONENTS + Uint32Array.BYTES_PER_ELEMENT * 2 * 4 + Uint32Array.BYTES_PER_ELEMENT + Uint32Array.BYTES_PER_ELEMENT + Uint32Array.BYTES_PER_ELEMENT + MAX_NUMBER_OF_EDGES_AFTER_TRIMMING * Uint32Array.BYTES_PER_ELEMENT * EDGE_NUMBER_OF_COMPONENTS;
			let totalMemoryAllocatedUnits = "bytes";
			
			// Check if total memory allocated is at least a kilobyte
			if(totalMemoryAllocated >= BYTES_IN_A_KILOBYTE) {
			
				// Update total memory allocated and its units
				totalMemoryAllocated /= BYTES_IN_A_KILOBYTE;
				totalMemoryAllocatedUnits = "KB";
			}
			
			// Check if total memory allocated is at least a megabyte
			if(totalMemoryAllocated >= KILOBYTES_IN_A_MEGABYTE) {
			
				// Update total memory allocated and its units
				totalMemoryAllocated /= KILOBYTES_IN_A_MEGABYTE;
				totalMemoryAllocatedUnits = "MB";
			}
			
			// Check if total memory allocated is at least a gigabyte
			if(totalMemoryAllocated >= MEGABYTES_IN_A_GIGABYTE) {
			
				// Update total memory allocated and its units
				totalMemoryAllocated /= MEGABYTES_IN_A_GIGABYTE;
				totalMemoryAllocatedUnits = "GB";
			}
			
			// Display message
			console.log("Allocating " + (Math.ceil(totalMemoryAllocated * Math.pow(10, UNITS_MAX_NUMBER_OF_DECIMAL_NUMBERS)) / Math.pow(10, UNITS_MAX_NUMBER_OF_DECIMAL_NUMBERS)).toFixed(UNITS_MAX_NUMBER_OF_DECIMAL_NUMBERS).replace(/\.0*$/, "") + " " + totalMemoryAllocatedUnits + " of GPU memory");
			
			// Start detecting out of memory errors
			this.#device.pushErrorScope("out-of-memory");
			
			// Create nodes bitmap buffer
			this.#nodesBitmapBuffer = this.#device.createBuffer({
			
				// Size
				size: NUMBER_OF_EDGES / BITS_IN_A_BYTE,
				
				// Usage
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
			});
			
			// Create edges bitmap buffer
			this.#edgesBitmapBuffer = this.#device.createBuffer({
			
				// Size
				size: NUMBER_OF_EDGES / BITS_IN_A_BYTE,
				
				// Usage
				usage: GPUBufferUsage.STORAGE
			});
			
			// Create remaining edges buffer
			this.#remainingEdgesBuffer = this.#device.createBuffer({
			
				// Size
				size: Uint32Array.BYTES_PER_ELEMENT + MAX_NUMBER_OF_EDGES_AFTER_TRIMMING * Uint32Array.BYTES_PER_ELEMENT * EDGE_NUMBER_OF_COMPONENTS,
				
				// Usage
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
			});
			
			// Create SipHash keys buffer
			this.#sipHashKeysBuffer = this.#device.createBuffer({
			
				// Size
				size: Uint32Array.BYTES_PER_ELEMENT * 2 * 4,
				
				// Usage
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			});
			
			// Create nodes in second partition buffer
			this.#nodesInSecondPartitionBuffer = this.#device.createBuffer({
			
				// Size
				size: Uint32Array.BYTES_PER_ELEMENT,
				
				// Usage
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			});
			
			// Create starting index buffer
			this.#startingIndexBuffer = this.#device.createBuffer({
			
				// Size
				size: Uint32Array.BYTES_PER_ELEMENT,
				
				// Usage
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			});
			
			// Create result buffer
			this.#resultBuffer = this.#device.createBuffer({
			
				// Size
				size: Uint32Array.BYTES_PER_ELEMENT + MAX_NUMBER_OF_EDGES_AFTER_TRIMMING * Uint32Array.BYTES_PER_ELEMENT * EDGE_NUMBER_OF_COMPONENTS,
				
				// Usage
				usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
				
				// Mapped at creation
				mappedAtCreation: true
			});
			
			// Stop detecting out of memory errors
			const outOfMemoryError = await this.#device.popErrorScope();
			
			// Check if an out of memory error occurred
			if(outOfMemoryError !== null) {
			
				// Throw out of memory error
				throw outOfMemoryError;
			}
			
			// Create bind group
			this.#bindGroup = this.#device.createBindGroup({
			
				// Entries
				entries: [
				
					// Nodes bitmap and nodes bitmap atomic
					{
					
						// Binding
						binding: 0,
						
						// Resource
						resource: this.#nodesBitmapBuffer
					},
					
					// Edges bitmap
					{
					
						// Binding
						binding: 1,
						
						// Resource
						resource: this.#edgesBitmapBuffer
					},
					
					// Remaining edges
					{
					
						// Binding
						binding: 2,
						
						// Resource
						resource: this.#remainingEdgesBuffer
					},
					
					// SipHash keys
					{
					
						// Binding
						binding: 3,
						
						// Resource
						resource: this.#sipHashKeysBuffer
					},
					
					// Nodes in second partition
					{
					
						// Binding
						binding: 4,
						
						// Resource
						resource: this.#nodesInSecondPartitionBuffer
					},
					
					// Starting index
					{
					
						// Binding
						binding: 5,
						
						// Resource
						resource: this.#startingIndexBuffer
					}
				],
				
				// Layout
				layout: bindGroupLayout
			});
			
			// Display message
			console.log("Allocated memory");
		}
		
		// Trim edges
		async trimEdges(sipHashKeys) {
		
			// Unmap result buffer
			this.#resultBuffer.unmap();
			
			// Update SipHash keys buffer
			this.#device.queue.writeBuffer(this.#sipHashKeysBuffer, 0, sipHashKeys);
			
			// Run clearing first part of remaining edges buffer
			let commandEncoder = this.#device.createCommandEncoder();
			commandEncoder.clearBuffer(this.#remainingEdgesBuffer, 0, Uint32Array.BYTES_PER_ELEMENT);
			
			// Run clearing nodes bitmap buffer
			commandEncoder.clearBuffer(this.#nodesBitmapBuffer);
			this.#device.queue.submit([commandEncoder.finish()]);
			
			// Set previous operations complete
			let previousOperationsComplete = this.#device.queue.onSubmittedWorkDone();
			
			// Go through all step parts
			let computePass;
			for(let i = 0; i < LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP; ++i) {
			
				// Update starting index buffer
				this.#device.queue.writeBuffer(this.#startingIndexBuffer, 0, new Uint32Array([i * this.#totalNumberOfWorkItems[0]]));
				
				// Create compute pass
				commandEncoder = this.#device.createCommandEncoder();
				computePass = commandEncoder.beginComputePass();
				computePass.setBindGroup(0, this.#bindGroup);
				
				// Add running trim edges step one to the compute pass
				computePass.setPipeline(this.#pipelines[0]);
				computePass.dispatchWorkgroups(this.#numberOfWorkGroups[0][0], this.#numberOfWorkGroups[0][1]);
				
				// Run the compute pass
				computePass.end();
				this.#device.queue.submit([commandEncoder.finish()]);
				
				// Check if time to wait for operations to complete
				if((i + 1) % LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING === 0) {
				
					// Wait for previous operations to complete
					await previousOperationsComplete;
					
					// Update previous operations complete
					previousOperationsComplete = this.#device.queue.onSubmittedWorkDone();
				}
			}
			
			// Go through all step parts
			for(let i = 0; i < LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP; ++i) {
			
				// Update starting index buffer
				this.#device.queue.writeBuffer(this.#startingIndexBuffer, 0, new Uint32Array([i * this.#totalNumberOfWorkItems[1]]));
				
				// Create compute pass
				commandEncoder = this.#device.createCommandEncoder();
				computePass = commandEncoder.beginComputePass();
				computePass.setBindGroup(0, this.#bindGroup);
				
				// Add running trim edges step two to the compute pass
				computePass.setPipeline(this.#pipelines[1]);
				computePass.dispatchWorkgroups(this.#numberOfWorkGroups[1][0], this.#numberOfWorkGroups[1][1]);
				
				// Run the compute pass
				computePass.end();
				this.#device.queue.submit([commandEncoder.finish()]);
				
				// Check if time to wait for operations to complete
				if((i + 1) % LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING === 0) {
				
					// Wait for previous operations to complete
					await previousOperationsComplete;
					
					// Update previous operations complete
					previousOperationsComplete = this.#device.queue.onSubmittedWorkDone();
				}
			}
			
			// Go through all remaining trimming rounds
			for(let i = 1; i < TRIMMING_ROUNDS; ++i) {
			
				// Update nodes in second partition buffer
				this.#device.queue.writeBuffer(this.#nodesInSecondPartitionBuffer, 0, new Uint32Array([i % 2]));
				
				// Run clearing nodes bitmap buffer
				commandEncoder = this.#device.createCommandEncoder();
				commandEncoder.clearBuffer(this.#nodesBitmapBuffer);
				this.#device.queue.submit([commandEncoder.finish()]);
				
				// Go through all step parts
				for(let j = 0; j < LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP; ++j) {
				
					// Update starting index buffer
					this.#device.queue.writeBuffer(this.#startingIndexBuffer, 0, new Uint32Array([j * this.#totalNumberOfWorkItems[2]]));
					
					// Create compute pass
					commandEncoder = this.#device.createCommandEncoder();
					computePass = commandEncoder.beginComputePass();
					computePass.setBindGroup(0, this.#bindGroup);
					
					// Add running trim edges step three to the compute pass
					computePass.setPipeline(this.#pipelines[2]);
					computePass.dispatchWorkgroups(this.#numberOfWorkGroups[2][0], this.#numberOfWorkGroups[2][1]);
					
					// Run the compute pass
					computePass.end();
					this.#device.queue.submit([commandEncoder.finish()]);
					
					// Check if time to wait for operations to complete
					if((j + 1) % LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING === 0) {
					
						// Wait for previous operations to complete
						await previousOperationsComplete;
						
						// Update previous operations complete
						previousOperationsComplete = this.#device.queue.onSubmittedWorkDone();
					}
				}
				
				// Check if not at the last trimming round
				if(i !== TRIMMING_ROUNDS - 1) {
				
					// Go through all step parts
					for(let j = 0; j < LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP; ++j) {
					
						// Update starting index buffer
						this.#device.queue.writeBuffer(this.#startingIndexBuffer, 0, new Uint32Array([j * this.#totalNumberOfWorkItems[3]]));
						
						// Create compute pass
						commandEncoder = this.#device.createCommandEncoder();
						computePass = commandEncoder.beginComputePass();
						computePass.setBindGroup(0, this.#bindGroup);
						
						// Add running trim edges step four to the compute pass
						computePass.setPipeline(this.#pipelines[3]);
						computePass.dispatchWorkgroups(this.#numberOfWorkGroups[3][0], this.#numberOfWorkGroups[3][1]);
						
						// Run the compute pass
						computePass.end();
						this.#device.queue.submit([commandEncoder.finish()]);
						
						// Check if time to wait for operations to complete
						if((j + 1) % LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING === 0) {
						
							// Wait for previous operations to complete
							await previousOperationsComplete;
							
							// Update previous operations complete
							previousOperationsComplete = this.#device.queue.onSubmittedWorkDone();
						}
					}
				}
				
				// Otherwise
				else {
				
					// Go through all step parts
					for(let j = 0; j < LEAN_TRIMMING_NUMBER_OF_PARTS_PER_STEP; ++j) {
					
						// Update starting index buffer
						this.#device.queue.writeBuffer(this.#startingIndexBuffer, 0, new Uint32Array([j * this.#totalNumberOfWorkItems[4]]));
						
						// Create compute pass
						commandEncoder = this.#device.createCommandEncoder();
						computePass = commandEncoder.beginComputePass();
						computePass.setBindGroup(0, this.#bindGroup);
						
						// Add running trim edges step five to the compute pass
						computePass.setPipeline(this.#pipelines[4]);
						computePass.dispatchWorkgroups(this.#numberOfWorkGroups[4][0], this.#numberOfWorkGroups[4][1]);
						
						// Run the compute pass
						computePass.end();
						this.#device.queue.submit([commandEncoder.finish()]);
						
						// Check if time to wait for operations to complete
						if((j + 1) % LEAN_TRIMMING_NUMBER_OF_STEP_PARTS_BEFORE_WAITING === 0) {
						
							// Wait for previous operations to complete
							await previousOperationsComplete;
							
							// Update previous operations complete
							previousOperationsComplete = this.#device.queue.onSubmittedWorkDone();
						}
					}
				}
			}
			
			// Add running copying remaining edges buffer to the result buffer
			commandEncoder = this.#device.createCommandEncoder();
			commandEncoder.copyBufferToBuffer(this.#remainingEdgesBuffer, this.#resultBuffer);
			this.#device.queue.submit([commandEncoder.finish()]);
			
			// Wait for previous operations to complete
			await previousOperationsComplete;
			
			// Wait for mapping result buffer to finish
			await this.#resultBuffer.mapAsync(GPUMapMode.READ);
			
			// Return result buffer's contents
			return new Uint32Array(this.#resultBuffer.getMappedRange());
		}
	
	// Private
	
		// Device
		#device;
		
		// Total number of work items;
		#totalNumberOfWorkItems;
		
		// Number of work groups
		#numberOfWorkGroups;
		
		// Pipelines
		#pipelines;
		
		// Nodes bitmap buffer
		#nodesBitmapBuffer;
		
		// Edges bitmap buffer
		#edgesBitmapBuffer;
		
		// Remaining edges buffer
		#remainingEdgesBuffer;
		
		// SipHash keys buffer
		#sipHashKeysBuffer;
		
		// Nodes in second partition buffer
		#nodesInSecondPartitionBuffer;
		
		// Starting index buffer
		#startingIndexBuffer;
		
		// Result buffer
		#resultBuffer;
		
		// Bind group
		#bindGroup;
}
