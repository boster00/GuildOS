import { NextResponse } from 'next/server';
import cron from '@/libs/cron/class'
import { createClient } from "@/libs/supabase/service";
import { initMonkey } from "@/libs/monkey";


// cron lifecycle actions: each 1 minute, the following happens: 
// 1. manageTasks: update status for stuck tasks, add new tasks by going through each table. Now only prompts.
// 2. triggers a local worker to process tasks: getTasks -> processTasksLocal -> reportResults (multiple calls, one per task)

// external workers do the following: 1. getTasks -> [external] process the tasks in its own environment -> reportResults (multiple calls, one per task)

export async function POST(request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    
    const action = body.action || 'not set';
    if (action === 'test') {
      // temporary action, to assess certain actions.
      // Get existing cron jobs to avoid duplicates
      // const prompts = await cron.monkey.read('prompts',[{ operator: 'select', args: ['id,text,result'] }]);
      const promptId=body.promptId;

      await supabase.from('prompts').update({ scheduled_for: null }).eq('id', promptId);
      // const results = await cron.monkey.webCrawl("https://www.bosterbio.com/");
      // output = results;
      return NextResponse.json({ success: true, message: 'Job '+promptId+' has been scheduled to run ASAP' });

    }


    if (!body.CRON_SECRET || body.CRON_SECRET !== cron.cronSecret) {
      return NextResponse.json({ success: false, error: 'Invalid or missing CRON_SECRET' , CRONSECRETEINCRON: cron.cronSecret, body }, { status: 401 });
    }

    const monkey = await initMonkey();
    let requestId = null;
    if (monkey.diag.enabled()) {
      requestId = monkey.diag.genRequestId();
      monkey.diag.log('info', `cron action start: ${action}`, { action }, { request_id: requestId, source: 'cron' });
    }

    const jobType = body.jobType || 'prompt';
    const workerId = body.workerId || 'local';
    let output = null;

    if (action === 'test1') {
      cron.monkey.supabase = null;
      const prompts = await cron.monkey.read('prompts',[{ operator: 'select', args: ['id,text,result'] }]);
      output = prompts;
      
    }



    
    if (action === 'deleteAll') {
      await cron.emptyCronJobs();
      output = "cron jobs empty";
    }
    
    if (action === 'reset') {
      // temporary action, resets all cron jobs to queued
      const results = [];
      try {
        const tasks= await cron.monkey.read('cron_jobs');
        for (const task of tasks) {
          task.status='queued';
          const updateResult = await cron.monkey.update('cron_jobs', task);
          results.push(updateResult);
        }
      } catch (error) {
      }

      return NextResponse.json({ success: true, results, log: cron.log() });
    }
    
    if (action === 'getTasks') {
      // get the tasks from cron.getTasks, example request body: {CRON_SECRET, action: 'getTasks', jobType: 'prompt', workerId: 'worker1'}
      // example response body: {success:true, data: [{task details}...]}
      const tasks = await cron.getTasks(jobType, workerId);
      if (!tasks || tasks.length === 0) {
        output = [];
      }else{
        output = tasks;
        const assignResults = await cron.markTasksAsAssigned(tasks, workerId);

      }
      
    }
    
    if (action === 'processTasksLocal') {
      // this is the local worker processing tasks. Similar to external workers, it starts with requesting tasks via getTasks, then process each task, then reportResults.
      // this action is called by cron scheduler every X minutes.
      // example request body: {action: 'processTasksLocal' }
      cron.log("3. Cron: Local worker processing tasks started, getting tasks");
      const body = {
        action: "getTasks",
        jobType: "prompt",
        worker: 'local',
      };
      const response = await cron.cronApiCall(body);
      const tasks = response.data;
      cron.log("4. Cron: Local worker received " + tasks.length + " tasks to process");

      // 2. process tasks
      const results = await cron.processTasks(tasks);
      
      // 3. print results
      output = results;

    }

    
    if (action === 'reportResults') {
      // worker calls this to report finished tasks, input: {jobType, workerId, data: [...tasks with results]}, output: {success}. This is the end of its line, no actions after this so no output.
      const tasksWithResults = body.data;
      await cron.reportResults(tasksWithResults);
    }
    
    if (action === 'manageTasks') {
      // cron lifecycle action: each 1 minute, the following happens:
      // Add Tasks: go through prompt table, add each prompt to cron_jobs. Retain id -> task_id, user_id, job_type. 
      // condition: scheduled_for is null or scheduled_for < now()
      await cron.addNewTasks('prompt');
      
      // requeue stuck tasks: find tasks in processing status for more than X minutes (set in env), set them back to queued.
      await cron.requeueStuckTasks();

      // archive finished tasks: find tasks in completed status, archive them (move result to original table, delete from cron_jobs table)
      await cron.archiveFinishedTasks();
    }

    

    

    if (monkey.diag.enabled()) {
      await monkey.diag.flush({ request_id: requestId, source: 'cron' });
    }
    return NextResponse.json({ success:true, data: output, log: cron.log() });

  } catch (error) {
    const monkey = await initMonkey().catch(() => null);
    if (monkey?.diag?.enabled?.()) {
      const requestId = monkey.diag.genRequestId();
      monkey.diag.log('error', 'cron route failed', { error_name: error?.name, stack: String(error?.stack || '').slice(0, 2000) }, { request_id: requestId, source: 'cron' });
      await monkey.diag.flush({ request_id: requestId, source: 'cron' });
    }
    // Extract line info and file name from error stack
    let lineInfo = '';
    let fileName = '';
    if (error.stack) {
      const lineMatch = error.stack.match(/:(\d+):\d+\)?$/m);
      if (lineMatch) {
      lineInfo = ` Error Line: ${lineMatch[1]}`;
      }
      const fileMatch = error.stack.match(/at\s+(?:.+\s)?\(?([^)]+):\d+:\d+\)?/m);
      if (fileMatch) {
      fileName = ` File: ${fileMatch[1]}`;
      }
    }
    return NextResponse.json({ success: false, error: error.message + lineInfo + fileName, log: cron.log() }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}