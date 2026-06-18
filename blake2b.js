// Use strict
"use strict";


// Classes

// BLAKE2b class
class Blake2b {

	// Public
	
		// Constructor
		constructor() {
		
			// Throw exception
			throw new TypeError("BLAKE2b instances can't be constructed");
		}
		
		// Compute
		static compute(input, key = Blake2b.NO_KEY, outputSize = Blake2b.DEFAULT_OUTPUT_SIZE) {
		
			// Check if input is the wrong type
			if(input instanceof Uint8Array === false) {
			
				// Throw exception
				throw new TypeError("Input must be a Uint8Array");
			}
			
			// Check if input is invalid
			if(input.length > Number.MAX_SAFE_INTEGER - (Blake2b.#BLOCK_SIZE - 1)) {
			
				// Throw exception
				throw new RangeError("Input size must be less than or equal to " + (Number.MAX_SAFE_INTEGER - (Blake2b.#BLOCK_SIZE - 1)).toFixed());
			}
			
			// Check if key is the wrong type
			if(key !== Blake2b.NO_KEY && key instanceof Uint8Array === false) {
			
				// Throw exception
				throw new TypeError("Key must be null or a Uint8Array");
			}
			
			// Check if key is invalid
			if(key !== Blake2b.NO_KEY && (key.length === 0 || key.length > Blake2b.#MAX_KEY_SIZE)) {
			
				// Throw exception
				throw new RangeError("Key's size must be greater than zero and less than or equal to " + Blake2b.#MAX_KEY_SIZE.toFixed());
			}
			
			// Check if output size is the wrong type
			if(Number.isInteger(outputSize) === false) {
			
				// Throw exception
				throw new TypeError("Output size must be an integer");
			}
			
			// Check if output size is invalid
			if(outputSize <= 0 || outputSize > Blake2b.#MAX_OUTPUT_SIZE) {
			
				// Throw exception
				throw new RangeError("Output size must be greater than zero and less than or equal to " + Blake2b.#MAX_OUTPUT_SIZE.toFixed());
			}
			
			// Set state to the initialization vector
			const state = new Array(Blake2b.#INITIALIZATION_VECTOR.length);
			for(let i = 0; i < state.length; ++i) {
			
				state[i] = new Uint8Array(Blake2b.#INITIALIZATION_VECTOR[i]);
			}
			
			// Update state with parameters
			state[0][0] ^= outputSize;
			state[0][2] ^= 1;
			state[0][3] ^= 1;
			
			// Set counter to zero
			const counter = new Uint8Array(Blake2b.#BYTES_IN_A_UINT64 * 2);
			
			// Check if key exists
			if(key !== Blake2b.NO_KEY) {
			
				// Update state with key
				state[0][1] ^= key.length;
				
				// Create block with the key
				const block = new Uint8Array(Blake2b.#BLOCK_SIZE);
				block.set(key);
				
				// Add block's size to counter
				counter[0] = block.length;
				
				// Update state with block
				Blake2b.#updateState(state, counter, block, input.length === 0);
				
				// Clear block
				block.fill(0);
			}
			
			// Otherwise check if input is empty
			else if(input.length === 0) {
			
				// Update state with an empty block
				Blake2b.#updateState(state, counter, new Uint8Array(Blake2b.#BLOCK_SIZE), true);
			}
			
			// Go through all blocks of input
			for(let i = 0, j = Math.floor((input.length + (Blake2b.#BLOCK_SIZE - 1)) / Blake2b.#BLOCK_SIZE); i < j; ++i) {
			
				// Get block from input
				const block = input.subarray(i * Blake2b.#BLOCK_SIZE, (i + 1) * Blake2b.#BLOCK_SIZE);
				
				// Go through all bytes in counter while carry exists
				for(let k = 0, carry = block.length; k < counter.length && carry > 0; ++k) {
				
					// Add byte to carry
					carry += counter[k];
					
					// Set byte to carry's byte
					counter[k] = carry;
					
					// Remove byte from carry
					carry >>= Blake2b.#BITS_IN_A_BYTE;
				}
				
				// Pad block to be the correct size
				const paddedBlock = new Uint8Array(Blake2b.#BLOCK_SIZE);
				paddedBlock.set(block);
				
				// Update state with padded block
				Blake2b.#updateState(state, counter, paddedBlock, i === j - 1);
				
				// Clear padded block
				paddedBlock.fill(0);
			}
			
			// Create result
			const result = new Uint8Array(state.length * Blake2b.#BYTES_IN_A_UINT64);
			
			// Go through all parts in the state
			for(let i = 0; i < state.length; ++i) {
			
				// Append part to the result
				result.set(state[i], i * Blake2b.#BYTES_IN_A_UINT64);
				
				// Clear part
				state[i].fill(0);
			}
			
			// Shorten result to have the specified output size
			const resultWithCorrectSize = new Uint8Array(result.subarray(0, outputSize));
			
			// Clear result
			result.fill(0);
			
			// Return the result with the correct size
			return resultWithCorrectSize;
		}
		
		// No key
		static get NO_KEY() {
		
			// Return no key
			return null;
		}
		
		// Default output size
		static get DEFAULT_OUTPUT_SIZE() {
		
			// Return default output size
			return 32;
		}
		
	// Private
	
		// Add arrays
		static #addArrays(valueOne, valueTwo) {
		
			// Go through all bytes in value one
			for(let i = 0, carry = 0; i < valueOne.length; ++i) {
			
				// Add sum of value's bytes to carry
				carry += valueOne[i] + valueTwo[i];
				
				// Set byte to carry's byte
				valueOne[i] = carry;
				
				// Remove byte from carry
				carry >>= Blake2b.#BITS_IN_A_BYTE;
			}
		}
		
		// Update state
		static #updateState(state, counter, block, lastBlock) {
		
			// Get working state from state and initialization vector
			const workingState = new Array(state.length + Blake2b.#INITIALIZATION_VECTOR.length);
			for(let i = 0; i < state.length; ++i) {
			
				workingState[i] = new Uint8Array(state[i]);
				workingState[i + state.length] = new Uint8Array(Blake2b.#INITIALIZATION_VECTOR[i]);
			}
			
			// Go through all bytes in the work state's parts
			for(let i = 0; i < Blake2b.#BYTES_IN_A_UINT64; ++i) {
			
				// Update working state with the counter and if it's the last block
				workingState[12][i] ^= counter[i];
				workingState[13][i] ^= counter[i + Blake2b.#BYTES_IN_A_UINT64];
				workingState[14][i] ^= -lastBlock;
			}
			
			// Get block's parts
			const blockParts = new Array(block.length / Blake2b.#BYTES_IN_A_UINT64);
			for(let i = 0; i < blockParts.length; ++i) {
			
				blockParts[i] = block.subarray(i * Blake2b.#BYTES_IN_A_UINT64, (i + 1) * Blake2b.#BYTES_IN_A_UINT64);
			}
			
			// Go through all rounds
			for(let i = 0; i < Blake2b.#NUMBER_OF_ROUNDS; ++i) {
			
				// Perform steps on working state
				Blake2b.#step(i, 0, workingState[0], workingState[4], workingState[8], workingState[12], blockParts);
				Blake2b.#step(i, 1, workingState[1], workingState[5], workingState[9], workingState[13], blockParts);
				Blake2b.#step(i, 2, workingState[2], workingState[6], workingState[10], workingState[14], blockParts);
				Blake2b.#step(i, 3, workingState[3], workingState[7], workingState[11], workingState[15], blockParts);
				Blake2b.#step(i, 4, workingState[0], workingState[5], workingState[10], workingState[15], blockParts);
				Blake2b.#step(i, 5, workingState[1], workingState[6], workingState[11], workingState[12], blockParts);
				Blake2b.#step(i, 6, workingState[2], workingState[7], workingState[8], workingState[13], blockParts);
				Blake2b.#step(i, 7, workingState[3], workingState[4], workingState[9], workingState[14], blockParts);
			}
			
			// Go through all parts in the state
			for(let i = 0; i < state.length; ++i) {
			
				// Go through all bytes in the part
				for(let j = 0; j < state[i].length; ++j) {
				
					// Update byte with the working state's bytes
					state[i][j] ^= workingState[i][j] ^ workingState[i + state.length][j];
				}
				
				// Clear working state's parts
				workingState[i].fill(0);
				workingState[i + state.length].fill(0);
			}
		}
		
		// Step
		static #step(round, index, a, b, c, d, blockParts) {
		
			// Get a += b + block part
			Blake2b.#addArrays(a, b);
			Blake2b.#addArrays(a, blockParts[Blake2b.#SIGMA[round][index * 2]]);
			
			// Get d = rotr(d ^ a, 32)
			let tempOne = d[0];
			d[0] = d[4] ^ a[4];
			d[4] = tempOne ^ a[0];
			tempOne = d[1];
			d[1] = d[5] ^ a[5];
			d[5] = tempOne ^ a[1];
			tempOne = d[2];
			d[2] = d[6] ^ a[6];
			d[6] = tempOne ^ a[2];
			tempOne = d[3];
			d[3] = d[7] ^ a[7];
			d[7] = tempOne ^ a[3];
			
			// Get c += d
			Blake2b.#addArrays(c, d);
			
			// Get b = rotr(b ^ c, 24)
			tempOne = b[7];
			b[7] = b[2] ^ c[2];
			let tempTwo = b[4];
			b[4] = tempOne ^ c[7];
			tempOne = b[1];
			b[1] = tempTwo ^ c[4];
			tempTwo = b[6];
			b[6] = tempOne ^ c[1];
			tempOne = b[3];
			b[3] = tempTwo ^ c[6];
			tempTwo = b[0];
			b[0] = tempOne ^ c[3];
			tempOne = b[5];
			b[5] = tempTwo ^ c[0];
			b[2] = tempOne ^ c[5];
			
			// Get a += b + block part
			Blake2b.#addArrays(a, b);
			Blake2b.#addArrays(a, blockParts[Blake2b.#SIGMA[round][index * 2 + 1]]);
			
			// Get d = rotr(d ^ a, 16)
			tempOne = d[7];
			d[7] = d[1] ^ a[1];
			tempTwo = d[5];
			d[5] = tempOne ^ a[7];
			tempOne = d[3];
			d[3] = tempTwo ^ a[5];
			d[1] = tempOne ^ a[3];
			tempOne = d[6];
			d[6] = d[0] ^ a[0];
			tempTwo = d[4];
			d[4] = tempOne ^ a[6];
			tempOne = d[2];
			d[2] = tempTwo ^ a[4];
			d[0] = tempOne ^ a[2];
			
			// Get c += d
			Blake2b.#addArrays(c, d);
			
			// Get b ^= c
			for(let i = 0; i < b.length; ++i) {
			
				b[i] ^= c[i];
			}
			
			// Get b = rotr(b, 63)
			tempOne = b[7];
			b[7] = (b[7] << 1) | (b[6] >> (Blake2b.#BITS_IN_A_BYTE - 1));
			b[6] = (b[6] << 1) | (b[5] >> (Blake2b.#BITS_IN_A_BYTE - 1));
			b[5] = (b[5] << 1) | (b[4] >> (Blake2b.#BITS_IN_A_BYTE - 1));
			b[4] = (b[4] << 1) | (b[3] >> (Blake2b.#BITS_IN_A_BYTE - 1));
			b[3] = (b[3] << 1) | (b[2] >> (Blake2b.#BITS_IN_A_BYTE - 1));
			b[2] = (b[2] << 1) | (b[1] >> (Blake2b.#BITS_IN_A_BYTE - 1));
			b[1] = (b[1] << 1) | (b[0] >> (Blake2b.#BITS_IN_A_BYTE - 1));
			b[0] = (b[0] << 1) | (tempOne >> (Blake2b.#BITS_IN_A_BYTE - 1));
		}
		
		// Bits in a byte
		static #BITS_IN_A_BYTE = 8;
		
		// Max output size
		static #MAX_OUTPUT_SIZE = 64;
		
		// Max key size
		static #MAX_KEY_SIZE = 64;
		
		// Block size
		static #BLOCK_SIZE = 128;
		
		// Bytes in a uint64
		static #BYTES_IN_A_UINT64 = 8;
		
		// Number of rounds
		static #NUMBER_OF_ROUNDS = 12;
		
		// Initialization vector
		static #INITIALIZATION_VECTOR = [
			new Uint8Array([0x08, 0xC9, 0xBC, 0xF3, 0x67, 0xE6, 0x09, 0x6A]),
			new Uint8Array([0x3B, 0xA7, 0xCA, 0x84, 0x85, 0xAE, 0x67, 0xBB]),
			new Uint8Array([0x2B, 0xF8, 0x94, 0xFE, 0x72, 0xF3, 0x6E, 0x3C]),
			new Uint8Array([0xF1, 0x36, 0x1D, 0x5F, 0x3A, 0xF5, 0x4F, 0xA5]),
			new Uint8Array([0xD1, 0x82, 0xE6, 0xAD, 0x7F, 0x52, 0x0E, 0x51]),
			new Uint8Array([0x1F, 0x6C, 0x3E, 0x2B, 0x8C, 0x68, 0x05, 0x9B]),
			new Uint8Array([0x6B, 0xBD, 0x41, 0xFB, 0xAB, 0xD9, 0x83, 0x1F]),
			new Uint8Array([0x79, 0x21, 0x7E, 0x13, 0x19, 0xCD, 0xE0, 0x5B])
		];
		
		// Sigma
		static #SIGMA = [
			[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
			[14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
			[11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
			[7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
			[9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
			[2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
			[12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
			[13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
			[6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
			[10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
			[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
			[14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3]
		];
}
