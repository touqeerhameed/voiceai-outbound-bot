import { logMessage } from "./logger.js";



export function MAKE_PROMPT(
    //PROMPT
    persona_tone, core_objective, key_rules_constraints, unresponsive_spam, tool_functions, ai_datetime_handling, prompt_misc,
    call_flow, business_knowledge_base, example_scenario, table_faqs, pronunciation, kpi_assessment,
    //REPLACEMENT
    is_record_disclaimer, record_disclaimer, FROM, ai_tags_dictionary, website, company_name, agent_name,
    greeting,business_services,business_description,full_name,email_address,call_phonenumber,opening_hours ) 
  {
    
     
    try {
      // Format FAQs into a readable string
      let faqsSection = '';
      if (table_faqs && Array.isArray(table_faqs) && table_faqs.length > 0) {
        faqsSection = '\n\n ### FREQUENTLY ASKED QUESTIONS:\n';
        table_faqs.forEach((faq, index) => {
          if (faq.question && faq.answer) {
            faqsSection += `\nQ${index + 1}: ${faq.question}\nA${index + 1}: ${faq.answer}\n`;
          }
        });
      }
       
      let prompt = `
      ${persona_tone ? persona_tone + '\n\n' : ''}
      ${core_objective ? core_objective + '\n\n' : ''}
      ${key_rules_constraints ? key_rules_constraints + '\n\n' : ''}
      ${unresponsive_spam ? unresponsive_spam + '\n\n' : ''}
      ${tool_functions ? tool_functions + '\n\n' : ''}
      ${ai_datetime_handling ? ai_datetime_handling + '\n\n' : ''}
      ${prompt_misc ? prompt_misc + '\n\n' : ''}
      ${call_flow ? call_flow + '\n\n' : ''}
      ${business_knowledge_base ? business_knowledge_base + '\n\n' : ''}
      
      ${faqsSection ? faqsSection + '\n\n' : ''}

      ${example_scenario ? example_scenario + '\n\n' : '' }
      ${pronunciation ? pronunciation + '\n\n' : ''}
      ${kpi_assessment ? kpi_assessment + '\n\n' : ''}
      `.trim();

      // Apply replacements to the constructed prompt
      prompt = PROMPT_REPLACEMENT(prompt, FROM, ai_tags_dictionary);
    //   logMessage(`After PROMPT_REPLACEMENT replacement prompt : ${prompt}`);
      
      prompt = PROMPT_EXPLICIT_REPLACEMENT(prompt, is_record_disclaimer, record_disclaimer, website, company_name, agent_name,greeting,business_services,business_description,full_name,email_address,call_phonenumber,opening_hours);
      prompt = PROMPT_EXPLICIT_REPLACEMENT(prompt, is_record_disclaimer, record_disclaimer, website, company_name, agent_name,greeting,business_services,business_description,full_name,email_address,call_phonenumber,opening_hours);
                                          
      logMessage(`FINAL PROMPT **  :prompt : ${prompt}`);
      
      return prompt;
      
    } catch (error) {
      logMessage('Error in MAKE_PROMPT:', error.message);
      console.log('Error in MAKE_PROMPT:', error.message);
      return ''; // Return empty string if error occurs
    }
}
 

function PROMPT_EXPLICIT_REPLACEMENT(prompt, is_record_disclaimer, record_disclaimer, website, company_name, agent_name,greeting,business_services,business_description,full_name,email_address,call_phonenumber,opening_hours) {
                                     
  try {

    //  logMessage("SHOW ME PROMPT CONDITION", prompt);

    //  if (prompt.includes('[AGENT_NAME]'))
    //  {
    //   logMessage("Yes it exist [AGENT_NAME] ",agent_name);

    //  }


     
    //  if (prompt.includes('[FULLNAME]'))
    //  {
    //   logMessage("Yes it exist [FULLNAME] ",full_name);

    //  }

      if (prompt.includes('[GREETING]') && greeting && greeting.trim() !== '') {
      prompt = prompt.replace(/\[GREETING\]/g, greeting);
    }


    // Handle [Disclaimer] replacement
    if (is_record_disclaimer === true || is_record_disclaimer === 1) {
    //   if (record_disclaimer && record_disclaimer.trim() !== '') {
    if (prompt.includes('[Disclaimer]')) {
      prompt = prompt.replace(/\[Disclaimer\]/g, record_disclaimer);
    }
    //   }
     }
     else {

      if (prompt.includes('[Disclaimer]')) {          
        prompt = prompt.replace(/\[Disclaimer\]/g, "");                                    
      }
    }

    // Handle [BUSINESS_WEBSITE] replacement
    if (prompt.includes('[BUSINESS_WEBSITE]') && website && website.trim() !== '') {
      prompt = prompt.replace(/\[BUSINESS_WEBSITE\]/g, website);
    }

    // Handle [BUSINESS_NAME] replacement
    if (prompt.includes('[BUSINESS_NAME]') && company_name && company_name.trim() !== '') {
      prompt = prompt.replace(/\[BUSINESS_NAME\]/g, company_name);
    }

    // Handle [AGENT_NAME] replacement
    if (prompt.includes('[AGENT_NAME]') && agent_name && agent_name.trim() !== '') {
      prompt = prompt.replace(/\[AGENT_NAME\]/g, agent_name);
    }

   

    if (prompt.includes('[BUSINESS_OVERVIEW]') && business_description && business_description.trim() !== '') {
      prompt = prompt.replace(/\[BUSINESS_OVERVIEW\]/g, business_description);
    }

     if (prompt.includes('[BUSINESS_SERVICES]') && business_services && business_services.trim() !== '') {
      prompt = prompt.replace(/\[BUSINESS_SERVICES\]/g, business_services);
    }

    //if (prompt.includes('[FULLNAME]') && full_name && full_name.trim() !== '') {
    if (prompt.includes('[FULLNAME]')  && full_name && full_name.trim() !== '') {
      // logMessage("try for [FULLNAME]",full_name);
      prompt = prompt.replace(/\[FULLNAME\]/g, full_name);
    }

     if (prompt.includes('[EMAILADDRESS]') && email_address && email_address.trim() !== '') {
      // logMessage("try for [EMAILADDRESS]",email_address);
      prompt = prompt.replace(/\[EMAILADDRESS\]/g, email_address);
    }

     if (prompt.includes('[CALLPHONENO]') && call_phonenumber && call_phonenumber.trim() !== '') {
      //  logMessage("try for [CALLPHONENO]",call_phonenumber)
      prompt = prompt.replace(/\[CALLPHONENO\]/g, call_phonenumber);
    }

    if (prompt.includes('[OPENING_HOURS]') && opening_hours && opening_hours.trim() !== '') {
      prompt = prompt.replace(/\[OPENING_HOURS\]/g, opening_hours);
    }
     

    return prompt;

  } catch (error) {
    logMessage("Error in PROMPT_EXPLICIT_REPLACEMENT",error)
    logMessage("Error in PROMPT_EXPLICIT_REPLACEMENT",error.message)

    console.log('Error in PROMPT_EXPLICIT_REPLACEMENT:', error.message);
    return prompt; // Return original prompt if error occurs
  }
}

function PROMPT_REPLACEMENT(prompt, FROM, ai_tags_dictionary)
 {
  try {
    // 1. Get UK time with BST/GMT awareness  
    const ukDateOptions = {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    const ukTimeOptions12h = {
      timeZone: 'Europe/London',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    };
    const ukTimeOptions24h = {
      timeZone: 'Europe/London',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    };
     
    // 2. Format dates/times explicitly for UK
    const currentDate = new Date().toLocaleDateString('en-GB', ukDateOptions)
      .split('/').reverse().join('-'); // Converts DD/MM/YYYY → YYYY-MM-DD
    const currentTime12h = new Date().toLocaleTimeString('en-GB', ukTimeOptions12h);
    const currentTime24h = new Date().toLocaleTimeString('en-GB', ukTimeOptions24h);

    // Replace system tags first
    prompt = prompt
      .replace(/\[CURRENT_DATE_YYYY-MM-DD\]/g, currentDate)
      .replace(/\[CURRENT_TIME_HH:MM \(12h\)\]/g, currentTime12h)
      .replace(/\[CURRENT_TIME_HH:MM \(24h\)\]/g, currentTime24h)
      .replace(/\[CALLERPHONENO\]/g, FROM);   
        
    // 3. Replace AI tags if ai_tags_dictionary is available
    if (Array.isArray(ai_tags_dictionary) && ai_tags_dictionary.length > 0) {
      ai_tags_dictionary.forEach(tagObj => {
        const aiTag = tagObj.ai_tag;
        const aiTagData = tagObj.ai_tag_data;
        const ai_tag_pick = tagObj.ai_tag_pick;
        
        // Only replace if tag is picked (ai_tag_pick === 1) AND has data
        if (aiTag && aiTagData !== null && aiTagData !== undefined && (ai_tag_pick === true || ai_tag_pick === 1)) {
          // Escape special regex characters in the tag
          const escapedTag = aiTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedTag, 'g');
          prompt = prompt.replace(regex, aiTagData);
        }
      });
    }

    return prompt;
    
  } catch (error) {
    console.log('Error in PROMPT_REPLACEMENT:', error.message);
    return prompt; // Return original prompt if error occurs
  }
}

 