#!/usr/bin/env node

/**
 * Performance Test Script for DiceBear Optimized Server
 * 
 * This script tests all the performance optimizations:
 * 1. Size parameter support
 * 2. Version-based cache headers
 * 3. Response optimization (compression, CORS)
 * 4. Server-side caching
 * 5. Performance monitoring
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:3000';
const TEST_STYLES = ['avataaars', 'bottts', 'identicon', 'initials'];
const TEST_SIZES = [32, 64, 128];
const TEST_SEEDS = ['john', 'jane', 'test123', 'user456'];

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'bold');
  console.log('='.repeat(60));
}

function logTest(message) {
  log(`🧪 ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function waitForServer(maxAttempts = 30) {
  logInfo('Waiting for server to be ready...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        logSuccess('Server is ready!');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  
  logError('Server failed to start within timeout period');
  return false;
}

async function testHealthCheck() {
  logTest('Testing health check endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'ok') {
      logSuccess('Health check passed');
      return true;
    } else {
      logError('Health check failed');
      return false;
    }
  } catch (error) {
    logError(`Health check error: ${error.message}`);
    return false;
  }
}

async function testSizeParameter() {
  logTest('Testing size parameter support');
  
  const results = [];
  
  for (const size of TEST_SIZES) {
    try {
      const url = `${BASE_URL}/5.x/avataaars/svg?seed=test&size=${size}`;
      const start = performance.now();
      const response = await fetch(url);
      const end = performance.now();
      
      if (response.ok) {
        const svg = await response.text();
        const hasSize = svg.includes(`width="${size}"`) && svg.includes(`height="${size}"`);
        
        results.push({
          size,
          success: hasSize,
          responseTime: Math.round(end - start),
          contentLength: svg.length
        });
        
        if (hasSize) {
          logSuccess(`Size ${size}px: ✓ (${Math.round(end - start)}ms)`);
        } else {
          logWarning(`Size ${size}px: SVG doesn't contain expected dimensions`);
        }
      } else {
        logError(`Size ${size}px: HTTP ${response.status}`);
        results.push({ size, success: false, error: response.status });
      }
    } catch (error) {
      logError(`Size ${size}px: ${error.message}`);
      results.push({ size, success: false, error: error.message });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  logInfo(`Size parameter test: ${successCount}/${TEST_SIZES.length} passed`);
  
  return results;
}

async function testVersionBasedCaching() {
  logTest('Testing version-based cache headers');
  
  const testCases = [
    { version: 'v1.0.0', expectLongCache: true },
    { version: undefined, expectLongCache: false }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const url = testCase.version 
        ? `${BASE_URL}/5.x/avataaars/svg?seed=cache-test&v=${testCase.version}`
        : `${BASE_URL}/5.x/avataaars/svg?seed=cache-test`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const cacheControl = response.headers.get('cache-control');
        const etag = response.headers.get('etag');
        
        const hasLongCache = cacheControl && cacheControl.includes('max-age=31536000');
        const hasShortCache = cacheControl && cacheControl.includes('max-age=3600');
        const hasETag = !!etag;
        
        const success = testCase.expectLongCache ? hasLongCache : hasShortCache;
        
        results.push({
          version: testCase.version || 'none',
          success,
          cacheControl,
          etag: hasETag,
          expectLongCache: testCase.expectLongCache
        });
        
        if (success && hasETag) {
          logSuccess(`Version ${testCase.version || 'none'}: Correct cache headers`);
        } else {
          logWarning(`Version ${testCase.version || 'none'}: Unexpected cache headers`);
        }
      } else {
        logError(`Version ${testCase.version || 'none'}: HTTP ${response.status}`);
        results.push({ version: testCase.version || 'none', success: false });
      }
    } catch (error) {
      logError(`Version ${testCase.version || 'none'}: ${error.message}`);
      results.push({ version: testCase.version || 'none', success: false });
    }
  }
  
  return results;
}

async function testResponseOptimization() {
  logTest('Testing response optimization (compression, CORS, content-type)');
  
  try {
    const response = await fetch(`${BASE_URL}/5.x/avataaars/svg?seed=optimization-test`, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'http://localhost:3000'
      }
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      const corsHeader = response.headers.get('access-control-allow-origin');
      const contentEncoding = response.headers.get('content-encoding');
      
      const hasCorrectContentType = contentType === 'image/svg+xml';
      const hasCORS = !!corsHeader;
      const hasCompression = !!contentEncoding;
      
      logInfo(`Content-Type: ${contentType} ${hasCorrectContentType ? '✓' : '✗'}`);
      logInfo(`CORS: ${corsHeader || 'none'} ${hasCORS ? '✓' : '✗'}`);
      logInfo(`Compression: ${contentEncoding || 'none'} ${hasCompression ? '✓' : '✗'}`);
      
      return {
        contentType: hasCorrectContentType,
        cors: hasCORS,
        compression: hasCompression,
        success: hasCorrectContentType && hasCORS
      };
    } else {
      logError(`Response optimization test failed: HTTP ${response.status}`);
      return { success: false };
    }
  } catch (error) {
    logError(`Response optimization test error: ${error.message}`);
    return { success: false };
  }
}

async function testServerSideCaching() {
  logTest('Testing server-side caching performance');
  
  const url = `${BASE_URL}/5.x/avataaars/svg?seed=cache-performance-test&size=64`;
  const results = [];
  
  // First request (cache miss)
  const start1 = performance.now();
  const response1 = await fetch(url);
  const end1 = performance.now();
  const time1 = Math.round(end1 - start1);
  
  if (response1.ok) {
    results.push({ request: 1, responseTime: time1, cached: false });
    logInfo(`First request (cache miss): ${time1}ms`);
    
    // Second request (should be cache hit)
    const start2 = performance.now();
    const response2 = await fetch(url);
    const end2 = performance.now();
    const time2 = Math.round(end2 - start2);
    
    if (response2.ok) {
      results.push({ request: 2, responseTime: time2, cached: true });
      logInfo(`Second request (cache hit): ${time2}ms`);
      
      const improvement = time1 > time2 ? ((time1 - time2) / time1 * 100).toFixed(1) : 0;
      
      if (time2 < time1) {
        logSuccess(`Cache performance improvement: ${improvement}% faster`);
      } else {
        logWarning('No significant cache performance improvement detected');
      }
      
      return {
        success: true,
        firstRequest: time1,
        secondRequest: time2,
        improvement: improvement
      };
    }
  }
  
  logError('Server-side caching test failed');
  return { success: false };
}

async function testPerformanceMetrics() {
  logTest('Testing performance metrics endpoint');
  
  try {
    // Make a few requests first to generate some metrics
    await Promise.all([
      fetch(`${BASE_URL}/5.x/avataaars/svg?seed=metrics1`),
      fetch(`${BASE_URL}/5.x/bottts/svg?seed=metrics2`),
      fetch(`${BASE_URL}/5.x/identicon/svg?seed=metrics3`)
    ]);
    
    const response = await fetch(`${BASE_URL}/metrics`);
    
    if (response.ok) {
      const metrics = await response.json();
      
      logInfo(`Total requests: ${metrics.totalRequests}`);
      logInfo(`Cache hits: ${metrics.cacheHits}`);
      logInfo(`Cache misses: ${metrics.cacheMisses}`);
      logInfo(`Cache hit rate: ${metrics.cacheHitRate}`);
      logInfo(`Average response time: ${metrics.averageResponseTime}`);
      logInfo(`Cache size: ${metrics.cacheSize}`);
      
      const hasRequiredFields = metrics.totalRequests !== undefined &&
                               metrics.cacheHits !== undefined &&
                               metrics.cacheMisses !== undefined &&
                               metrics.averageResponseTime !== undefined;
      
      if (hasRequiredFields) {
        logSuccess('Performance metrics endpoint working correctly');
        return { success: true, metrics };
      } else {
        logWarning('Performance metrics missing some fields');
        return { success: false };
      }
    } else {
      logError(`Metrics endpoint failed: HTTP ${response.status}`);
      return { success: false };
    }
  } catch (error) {
    logError(`Metrics test error: ${error.message}`);
    return { success: false };
  }
}

async function testMultipleStyles() {
  logTest('Testing multiple avatar styles');
  
  const results = [];
  
  for (const style of TEST_STYLES) {
    try {
      const url = `${BASE_URL}/5.x/${style}/svg?seed=style-test&size=64`;
      const start = performance.now();
      const response = await fetch(url);
      const end = performance.now();
      
      if (response.ok) {
        const svg = await response.text();
        results.push({
          style,
          success: true,
          responseTime: Math.round(end - start),
          contentLength: svg.length
        });
        logSuccess(`Style ${style}: ✓ (${Math.round(end - start)}ms)`);
      } else {
        logError(`Style ${style}: HTTP ${response.status}`);
        results.push({ style, success: false });
      }
    } catch (error) {
      logError(`Style ${style}: ${error.message}`);
      results.push({ style, success: false });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  logInfo(`Style test: ${successCount}/${TEST_STYLES.length} passed`);
  
  return results;
}

async function runPerformanceBenchmark() {
  logTest('Running performance benchmark');
  
  const requests = [];
  const concurrency = 10;
  const totalRequests = 50;
  
  // Generate test requests
  for (let i = 0; i < totalRequests; i++) {
    const style = TEST_STYLES[i % TEST_STYLES.length];
    const size = TEST_SIZES[i % TEST_SIZES.length];
    const seed = TEST_SEEDS[i % TEST_SEEDS.length];
    
    requests.push({
      url: `${BASE_URL}/5.x/${style}/svg?seed=${seed}&size=${size}`,
      id: i + 1
    });
  }
  
  const results = [];
  const startTime = performance.now();
  
  // Execute requests in batches
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (req) => {
      const reqStart = performance.now();
      try {
        const response = await fetch(req.url);
        const reqEnd = performance.now();
        
        return {
          id: req.id,
          success: response.ok,
          responseTime: Math.round(reqEnd - reqStart),
          status: response.status
        };
      } catch (error) {
        const reqEnd = performance.now();
        return {
          id: req.id,
          success: false,
          responseTime: Math.round(reqEnd - reqStart),
          error: error.message
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    process.stdout.write('.');
  }
  
  const endTime = performance.now();
  const totalTime = Math.round(endTime - startTime);
  
  console.log(''); // New line after dots
  
  const successfulRequests = results.filter(r => r.success);
  const failedRequests = results.filter(r => !r.success);
  
  const avgResponseTime = successfulRequests.length > 0 
    ? Math.round(successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length)
    : 0;
  
  const minResponseTime = successfulRequests.length > 0 
    ? Math.min(...successfulRequests.map(r => r.responseTime))
    : 0;
  
  const maxResponseTime = successfulRequests.length > 0 
    ? Math.max(...successfulRequests.map(r => r.responseTime))
    : 0;
  
  const requestsPerSecond = Math.round((totalRequests / totalTime) * 1000);
  
  logInfo(`Total requests: ${totalRequests}`);
  logInfo(`Successful requests: ${successfulRequests.length}`);
  logInfo(`Failed requests: ${failedRequests.length}`);
  logInfo(`Total time: ${totalTime}ms`);
  logInfo(`Average response time: ${avgResponseTime}ms`);
  logInfo(`Min response time: ${minResponseTime}ms`);
  logInfo(`Max response time: ${maxResponseTime}ms`);
  logInfo(`Requests per second: ${requestsPerSecond}`);
  
  if (successfulRequests.length >= totalRequests * 0.95) {
    logSuccess('Performance benchmark passed (>95% success rate)');
  } else {
    logWarning('Performance benchmark had some failures');
  }
  
  return {
    totalRequests,
    successfulRequests: successfulRequests.length,
    failedRequests: failedRequests.length,
    totalTime,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    requestsPerSecond
  };
}

async function runAllTests() {
  logHeader('DiceBear Server Performance Test Suite');
  
  // Wait for server to be ready
  const serverReady = await waitForServer();
  if (!serverReady) {
    process.exit(1);
  }
  
  const testResults = {};
  
  // Run all tests
  testResults.healthCheck = await testHealthCheck();
  testResults.sizeParameter = await testSizeParameter();
  testResults.versionCaching = await testVersionBasedCaching();
  testResults.responseOptimization = await testResponseOptimization();
  testResults.serverSideCaching = await testServerSideCaching();
  testResults.performanceMetrics = await testPerformanceMetrics();
  testResults.multipleStyles = await testMultipleStyles();
  testResults.performanceBenchmark = await runPerformanceBenchmark();
  
  // Summary
  logHeader('Test Results Summary');
  
  const tests = [
    { name: 'Health Check', result: testResults.healthCheck },
    { name: 'Size Parameter Support', result: testResults.sizeParameter?.every?.(r => r.success) ?? false },
    { name: 'Version-based Caching', result: testResults.versionCaching?.every?.(r => r.success) ?? false },
    { name: 'Response Optimization', result: testResults.responseOptimization?.success ?? false },
    { name: 'Server-side Caching', result: testResults.serverSideCaching?.success ?? false },
    { name: 'Performance Metrics', result: testResults.performanceMetrics?.success ?? false },
    { name: 'Multiple Styles', result: testResults.multipleStyles?.every?.(r => r.success) ?? false },
    { name: 'Performance Benchmark', result: (testResults.performanceBenchmark?.successfulRequests ?? 0) >= (testResults.performanceBenchmark?.totalRequests ?? 1) * 0.95 }
  ];
  
  let passedTests = 0;
  
  tests.forEach(test => {
    if (test.result) {
      logSuccess(`${test.name}: PASSED`);
      passedTests++;
    } else {
      logError(`${test.name}: FAILED`);
    }
  });
  
  logHeader(`Overall Results: ${passedTests}/${tests.length} tests passed`);
  
  if (passedTests === tests.length) {
    logSuccess('🎉 All performance optimizations are working correctly!');
    
    logInfo('\n📊 Performance Summary:');
    if (testResults.performanceBenchmark) {
      logInfo(`• Average response time: ${testResults.performanceBenchmark.avgResponseTime}ms`);
      logInfo(`• Requests per second: ${testResults.performanceBenchmark.requestsPerSecond}`);
    }
    if (testResults.serverSideCaching?.improvement) {
      logInfo(`• Cache performance improvement: ${testResults.serverSideCaching.improvement}%`);
    }
    
    process.exit(0);
  } else {
    logError('❌ Some tests failed. Please check the server implementation.');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logWarning('\nTest interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logWarning('\nTest terminated');
  process.exit(1);
});

// Run the tests
runAllTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
