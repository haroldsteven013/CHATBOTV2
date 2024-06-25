const { createBot, createProvider, createFlow, addKeyword } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/mock');
const axios = require('axios');
// Estructura para almacenar datos del usuario
const { EVENTS } = require('@bot-whatsapp/bot');
const { updateMessageWithPollUpdate, delay, captureEventStream } = require('@whiskeysockets/baileys');
const json = require('@bot-whatsapp/database/json');
//const { startInteractive } = require('@bot-whatsapp/cli');

const MAX_SUBJECT_LENGTH = 50; // Número máximo de caracteres para el asunto

// Función para normalizar y convertir a minúsculas 
function normalizeString(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
};

// Función para extraer valores usando una expresión regular
function extractValues(regex, str) {
    let values = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        values.push(match[1]);
    }
    return values;
};

function decodeHtmlEntities(text) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#xF3;': 'ó',
        '&#xE9;': 'é'
        // Puedes agregar más entidades según sea necesario
    };

    return text.replace(/&[a-zA-Z0-9#x]+;/g, (match) => {
        return entities[match] || match;
    });
};

// Función para normalizar caracteres especiales
function normalizeString(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
};

const flowConsulta = addKeyword(EVENTS.ACTION)
.addAction( async(_,{state,endFlow,gotoFlow,flowDynamic}) => {
    let itemsConsulta = [];
    let UserID = state.get('userId');
   console.log('rta:'+ UserID);
    const reqData = {
        UserID: UserID
    };
    console.log(reqData);
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPConsulta', reqData);
        console.log('Datos enviados correctamente:', response.data);
        const listaG = response.data;
         // Convertir entidades HTML a caracteres normales
         listaConsulta = listaG.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

         // Expresiones regulares para extraer los valores de 'id' y 'sym'
         let refNumRegex = /<AttrName>ref_num<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
         let refNum = extractValues(refNumRegex, listaConsulta);
 
         // Crear una lista con los valores
         for (let i = 0; i < refNum.length; i++) {
             itemsConsulta.push({
                 item: i + 1,
                 id: refNum[i]
             });
         };
         // Mostrar los resultados
         await state.update({consulta: itemsConsulta});
         console.log('estado:'+ JSON.stringify(state.get('consulta')));
         if(state.get('consulta')!= ''){
            return gotoFlow(flowCaso);
         }
         else{
            await flowDynamic('No se encontraron casos relacionados a la cuenta. Volviendo al inicio.');
            return gotoFlow(flowPrincipal);
         }
         
    }
    catch(error){
        if (error.response) {
            // El servidor respondió con un código de estado fuera del rango 2xx
            console.error('Error en la respuesta del servidor:', error.response.data);
            console.error('Código de estado:', error.response.status);
            console.error('Encabezados:', error.response.headers);
            
        } else if (error.request) {
            // La solicitud fue hecha pero no hubo respuesta
            console.error('No hubo respuesta del servidor:', error.request);

        } else {
            // Algo sucedió al configurar la solicitud
            console.error('Error al configurar la solicitud:', error.message);

        };
        console.error('Configuración de Axios:', error.config);
        return endFlow('No se logró encontrar casos relacionadas a su cuenta. Por favor intenta de nuevo.');
    };
});
const flowCaso = addKeyword(EVENTS.ACTION)
.addAction(async(_,{flowDynamic,state}) =>{
    let rtaCasosUser = state.get('consulta');
    let lista = JSON.stringify(state.get('ListaPrin'));
    let listaObj = JSON.parse(lista);
    let nombre = listaObj.first_name;
    let message = '';
    
    for(let i=0; i < rtaCasosUser.length; i++) {

            message += rtaCasosUser[i].item + '. ' + rtaCasosUser[i].id + '\n';
    };

    await flowDynamic(nombre+ ', estos son los casos que posee actualmente: \n' + message + '\n Escribe el número del ítem del caso el cual desea saber más detalles.');
})
.addAction({capture:true},async(ctx,{gotoFlow,state,fallBack,endFlow})=>{
    if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
        return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
    }
    else{

        const eleccion = parseInt(ctx.body);
        let esCorrecto = '';
        let encontrado = false;
       let lista =state.get('consulta');
        for (let i = 0; i < lista.length; i++){
            if(lista[i].item == eleccion ){ 
                encontrado = true;
                let caso = lista[i].id;
                await state.update({caso: caso});
                return gotoFlow(flowDetalleCaso);
            };
        }

        if(!encontrado){
            return fallBack('La selección no es válida. Por favor, ingrese un número de la lista.');
        }
    }
});

const flowDetalleCaso = addKeyword(EVENTS.ACTION)
.addAction(async(_, {flowDynamic,state,endFlow}) => {
    let caso = state.get('caso');
    let lista = JSON.stringify(state.get('ListaPrin'));
    let listaObj = JSON.parse(lista);
    let nombre = listaObj.first_name;
    const reqData = {
        ref_num: caso
    };
    console.log(reqData);
    

    // Enviar los datos a la API Gateway
    try {
        const response = await axios.post('http://192.168.10.83:8080/WPConsultaDetalle', reqData);
        console.log('Datos enviados correctamente:', response.data);
        let contenido = response.data;
         // Mostrar los resultados
         await state.update({contenidoCaso: contenido});
         console.log(JSON.parse(JSON.stringify(state.get('contenidoCaso'))));
         let jsoncont = JSON.parse(JSON.stringify(state.get('contenidoCaso')));
         console.log(jsoncont.ref_num);
         
        message = ' *Numero de referencia:* ' + contenido.ref_num + '\n *Descripción:* ' + contenido.summary + '\n *Estado:* '+ contenido.status + '\n *Solución:* '+ contenido.cat;
        await flowDynamic(nombre + ', estos son los detalles del caso seleccionado: \n \n'+ message + '\n \n¿Desea realizar alguna otra solicitud? (Sí/No)');

    } catch (error) {
        if (error.response) {
            // El servidor respondió con un código de estado fuera del rango 2xx
            console.error('Error en la respuesta del servidor:', error.response.data);
            console.error('Código de estado:', error.response.status);
            console.error('Encabezados:', error.response.headers);
            
        } else if (error.request) {
            // La solicitud fue hecha pero no hubo respuesta
            console.error('No hubo respuesta del servidor:', error.request);

        } else {
            // Algo sucedió al configurar la solicitud
            console.error('Error al configurar la solicitud:', error.message);

        };
        console.error('Configuración de Axios:', error.config);
        return endFlow('No se logró encontrar detalles relacionados al caso seleccionado. Por favor intenta de nuevo.');
    };
})
.addAction({capture:true},async(ctx,{flowDynamic,fallBack,endFlow})=>{
    if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
        return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
    }
    else{
        let bool = ctx.body;
        if(['si','Sí','SI','Si','SÍ','Yes','yes'].includes(normalizeString(bool))){
            await flowDynamic('Escribe *volver* para ver los detalles de otro caso. \nEscribe *creacion* si desea crear un caso o bien, escriba *salir* para terminar con la solicitud.');
        }
        else if (['No','no','NO'].includes(normalizeString(bool))) {
            return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
        } else {
            return fallBack('Por favor, ingresa una opción válida');
        };
    }
})
.addAction({capture:true},async(ctx,{flowDynamic,gotoFlow,fallBack,endFlow})=>{
    if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
        return endFlow('Terminando solicitud. Gracias por usar nuestro servicio!');
    }
    else{
        let bool = ctx.body;
        if(['volver','Volver','VOLVER'].includes(normalizeString(bool))){
            await flowDynamic('Regresando a la lista de casos....');
            return gotoFlow(flowCaso);
        }
        else if (['creacion','creación','CREACION','CREACIÓN','Creacion','Creación'].includes(normalizeString(bool))) {
            return gotoFlow(flowJuno);
        } else {
            return fallBack('Por favor, ingresa una opción válida');
        };
    }
})
;

const flowJuno = addKeyword(EVENTS.ACTION)
.addAction( async(_, { state,gotoFlow }) => {
    let lista = JSON.stringify(state.get('ListaPrin'));
    console.log('globalState:' + lista );
    let listaObj = JSON.parse(lista);
    let nombre = listaObj.first_name;
    console.log('Nombre:' + nombre);
    return gotoFlow(flowTickets);
});

const flowTickets =addKeyword(EVENTS.ACTION)
.addAction( async(_, {endFlow,state}) =>{
    let lista = JSON.stringify(state.get('ListaPrin'));
    let rtaUserID = JSON.parse(lista);
    let cnt = rtaUserID.ID;
    await state.update({cnt: cnt});
    let zcliente = rtaUserID.zcliente
    await state.update({zcliente: zcliente});
    let nombreUser = rtaUserID.first_name;
    await state.update({nombreUser: nombreUser});
    switch (zcliente) {
        case "400020": // SDH
            categoria="400168,400169,400051,400165,400166,400167,400053,400052,400168";
            break;
        case "400024": // TIGO-UNE
            categoria="400163,400001,400002,400101,400160,400163";
            break;
        case "400017": // DNP
            categoria="400052,400051,400053,400165,400166,400167,400052";
            break;
		case "400078": // BURO
            categoria="400160,400161,400160";
            break;
        default:
            categoria="5100,5101,5102,5103,5109,400001,400002,400051,400052,400053,400101,400158,400160,400161,400162,400163,400165,400166,400167,400168,400169,400170,400171,400172,400173,400174,400175,400176,400258,400308,400359,400360,400408,400409,400410,400411";
            break;
    };
    console.log(categoria);

    const reqData = {
        categoria: categoria
    };
    console.log(reqData);

    // Enviar los datos a la API Gateway
    try {
        let resultList = [];
        const response = await axios.post('http://192.168.10.83:8080/WPCAT', reqData);
        console.log('Datos enviados correctamente:', response.data);
        let listaG2 = response.data;

         // Convertir entidades HTML a caracteres normales
         listaG2 = listaG2.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

         // Expresiones regulares para extraer los valores de 'id' y 'sym'
         let idRegex = /<AttrName>id<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
         let symRegex = /<AttrName>ss_sym<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
         let ids = extractValues(idRegex, listaG2);
         let syms = extractValues(symRegex, listaG2);
 
         // Crear una lista con los valores
         for (let i = 0; i < ids.length; i++) {
             resultList.push({
                 item: i + 1,
                 id: ids[i],
                 sym: syms[i] || '' // En caso de que no haya un valor correspondiente de 'sym'
             });
         };
         // Mostrar los resultados
         await state.update({lista: resultList});
         console.log('estado:'+ JSON.stringify(state.get('lista')));

    } catch (error) {
        if (error.response) {
            // El servidor respondió con un código de estado fuera del rango 2xx
            console.error('Error en la respuesta del servidor:', error.response.data);
            console.error('Código de estado:', error.response.status);
            console.error('Encabezados:', error.response.headers);
            
        } else if (error.request) {
            // La solicitud fue hecha pero no hubo respuesta
            console.error('No hubo respuesta del servidor:', error.request);

        } else {
            // Algo sucedió al configurar la solicitud
            console.error('Error al configurar la solicitud:', error.message);

        };
        console.error('Configuración de Axios:', error.config);
        return endFlow('No se logró encontrar soluciones relacionadas a su cuenta. Por favor intenta de nuevo.');
    };

})  
.addAction(async(_,{flowDynamic,state}) =>{
    
    let nombre = state.get('nombreUser');
    console.log('nombre: '+ nombre);
    let rtaUserID = JSON.parse(JSON.stringify(state.get('lista')));
    let message = nombre + ', por favor escriba el número del ítem que corresponde a la solución para la cual se creará el caso:\n';

        for(let i=0; i < rtaUserID.length; i++) {

                const decodedSym = decodeHtmlEntities(rtaUserID[i].sym);
                message += rtaUserID[i].item + '. ' + decodedSym + '\n';
        };

    await flowDynamic(message);
})
.addAction({capture:true},async(ctx,{gotoFlow,state,fallBack,endFlow})=>{
    if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
        return endFlow('Terminando solicitud. Gracias por usar nuestros servicios!');
    }
    else{

        const eleccion = parseInt(ctx.body);
        let encontrado = false;
        let lista =JSON.parse(JSON.stringify(state.get('lista')));
        for (let i = 0; i < lista.length; i++){
            if(lista[i].item == eleccion ){ 
                encontrado = true;
                let decodedSym = decodeHtmlEntities(lista[i].sym);
                await state.update({solución: decodedSym});
                let pcat = lista[i].id;
                await state.update({pcat: pcat});
                return gotoFlow(flowCreation);
            };
        }

        if(!encontrado){
            return fallBack('La selección no es válida. Por favor, ingrese un número de la lista.');
        }
    }
});


const flowCreation = addKeyword(EVENTS.ACTION)     
.addAnswer('¿Cuál es el evento que quiere reportar?', { capture: true }, async(ctx, { state, endFlow }) => {
    const normalizedInput = normalizeString(ctx.body);

    if(['salir', 'Salir', 'SALIR', 'quit', 'QUIT', '0'].includes(normalizedInput)){
        return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
    } else {
        await state.update({ desc: normalizedInput });
        const descripcion = normalizedInput;
        const asunto = descripcion.length > MAX_SUBJECT_LENGTH ? 
        descripcion.substring(0, MAX_SUBJECT_LENGTH) + '...' : descripcion;
        await state.update({ asunto: asunto });
    }
})
.addAction(
    async(_,{flowDynamic,state})=>{
        let nombre = state.get('nombreUser');
        let solución = state.get('solución');
        let descripcion = state.get('desc');
        let asunto = state.get('asunto');
        let cancelo = false;
        await state.update({cancelo: cancelo});
        await flowDynamic(nombre + ', ya tengo todos los datos necesarios para la creación del caso. \n *Asunto:* '+ asunto + '. \n *Solución:* ' + solución + '. \n *Descripción:* ' + descripcion + '. \n \n ¿Es correcta la información suministrada? \n (Sí/ No)');
})

.addAction({capture:true},async(ctx,{flowDynamic,fallBack,endFlow,gotoFlow})=>{     
    if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
        return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
    }
    else{          
        let bool = ctx.body;
        if(['si','Sí','SI','SÍ','Yes','yes'].includes(normalizeString(bool))){
          await flowDynamic('Procesando solicitud... ');
          return gotoFlow(flowFinal);
        }
        else if (['No','no'].includes(normalizeString(bool))){
          await flowDynamic('Comprendo. ¿Desea volver a ingresar la información (Sí), o cancelar la solicitud de creación? (No)');
          return gotoFlow(flowVolver);
        } else {
          return fallBack('Por favor, ingresa una opción válida');
        };
    }
});

const flowVolver = addKeyword(EVENTS.ACTION)
.addAction({capture:true},async(ctx,{state,gotoFlow,flowDynamic})=>{
    if(['si','Sí','SI','SÍ','Yes','yes'].includes(normalizeString(ctx.body))){
        let cancelo = true;
        await flowDynamic('Volviendo a la lista de soluciones..');
        await state.update({cancelo: cancelo});
        return gotoFlow(flowJuno);
    }
    else if (['no','No','NO'].includes(normalizeString(ctx.body))){
        await flowDynamic('Solicitud cancelada. Volviendo al menú principal.');
        return gotoFlow(flowPrincipal);
    };
});

const flowFinal = addKeyword(EVENTS.ACTION)
.addAction( async(_, {state,flowDynamic,endFlow})=>{
            const msgTicket = {
                cnt: state.get('cnt'),
                categoria: state.get('pcat') ,
                asunto: state.get('asunto'),
                descripcion: state.get('desc')
            };

                // Enviar los datos a la API Gateway
                try {
                    const response = await axios.post('http://192.168.10.83:8080/WPTickets', msgTicket);
                    console.log('Datos enviados correctamente:', response.data);
                    const codTicket = JSON.parse(JSON.stringify(response.data));
                    // Expresión regular para extraer el valor de newRequestNumber
                
                    await flowDynamic('El caso con número de referencia '+ codTicket + ' fue creado con éxito! \n\n¿Desea realizar alguna solicitud adicional? (Sí/No)');

                } catch (error) {
                    if (error.response) {
                        // El servidor respondió con un código de estado fuera del rango 2xx
                        console.error('Error en la respuesta del servidor:', error.response.data);
                        console.error('Código de estado:', error.response.status);
                        console.error('Encabezados:', error.response.headers);
                        
                    } else if (error.request) {
                        // La solicitud fue hecha pero no hubo respuesta
                        console.error('No hubo respuesta del servidor:', error.request);
                        
                    } else {
                        // Algo sucedió al configurar la solicitud
                        console.error('Error al configurar la solicitud:', error.message);
                        
                    }
                    console.error('Configuración de Axios:', error.config);
                    return endFlow('No se puedo realizar tu solicitud. Por favor, intenta de nuevo.');
                };
            
})
.addAction({capture:true},async(ctx,{flowDynamic,fallBack,endFlow})=>{
    if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
        return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
    }
    else{
        let bool = ctx.body;
        if(['si','Sí','SI','SÍ','Yes','yes'].includes(normalizeString(bool))){
            await flowDynamic('Escribe *consulta* para consultar los casos del usuario. \nEscribe *creacion* si desea crear un caso o bien, escriba *salir* para terminar con la solicitud.');
        }
        else if (['No','no'].includes(normalizeString(bool))) {
            return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
        } else {
            return fallBack('Por favor, ingresa una opción válida');
        };
    }
})
.addAction({capture:true},async(ctx,{flowDynamic,gotoFlow,fallBack,endFlow})=>{
    if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
        return endFlow('Terminando solicitud. Gracias por usar nuestro servicio!');
    }
    else{
        let bool = ctx.body;
        if(['consulta','Consulta','CONSULTA'].includes(normalizeString(bool))){
            await flowDynamic('Regresando a la lista de casos....');
            return gotoFlow(flowConsulta);
        }
        else if (['creacion','creación','CREACION','CREACIÓN','Creacion','Creación'].includes(normalizeString(bool))) {
            return gotoFlow(flowJuno);
        } else {
            return fallBack('Por favor, ingresa una opción válida');
        };
    };
});

const flowInicio = addKeyword(EVENTS.WELCOME)
.addAnswer('Hola, soy Lucy!')
.addAnswer('Para empezar, por favor comparta la siguiente información: \n *Usuario para iniciar sesión en mesa de ayuda*',
        {capture:true},
       async (ctx, {fallBack,gotoFlow, state,endFlow}) => {
        if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
            return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
        }
        else{
                await state.update({userId: ctx.body});
                const reqData = {
                    UserID: ctx.body
                };
                console.log(reqData);

                    // Enviar los datos a la API Gateway
            try {
                const response = await axios.post('http://192.168.10.83:8080/WPUser', reqData);
                console.log('Datos enviados correctamente:', response.data);
                const listaG = response.data;
                console.log(listaG);
                await state.update({ListaPrin: listaG});
                return gotoFlow(flowPrincipal);
            } catch (error) {
                if (error.response) {
                    // El servidor respondió con un código de estado fuera del rango 2xx
                    console.error('Error en la respuesta del servidor:', error.response.data);
                    console.error('Código de estado:', error.response.status);
                    console.error('Encabezados:', error.response.headers);
                    
                } else if (error.request) {
                    // La solicitud fue hecha pero no hubo respuesta
                    console.error('No hubo respuesta del servidor:', error.request);
                    
                } else {
                    // Algo sucedió al configurar la solicitud
                    console.error('Error al configurar la solicitud:', error.message);
                }
                console.error('Configuración de Axios:', error.config);
                return fallBack('El usuario ingresado es incorrecto. Por favor, intenta de nuevo.');
            }
        }      
 });

const flowPrincipal = addKeyword(EVENTS.ACTION)
    .addAction(async(_, {state,flowDynamic}) =>{
        let lista = JSON.stringify(state.get('ListaPrin'));
        let listaObj = JSON.parse(lista);
        let nombre = listaObj.first_name;
        await flowDynamic(nombre+', en que puedo ayudarle? \n\n 1. Quiero crear un caso. \n 2. Quiero consultar mis casos \n \n Escribe el número correspondiente a su selección. ');
    })
    .addAction({capture:true}, 
    async(ctx, {flowDynamic,endFlow,fallBack,gotoFlow})=>{
        if(['salir','Salir','SALIR','quit','QUIT','0'].includes(normalizeString(ctx.body))){
            return endFlow('Terminando solicitud. Gracias por utilizar nuestros servicios!');
        }
        else{        
            if(parseInt(ctx.body) == 1){
                await flowDynamic('De acuerdo');
                return gotoFlow(flowJuno);
            }
            else if (parseInt(ctx.body) == 2) {
                await flowDynamic('De acuerdo');
                return gotoFlow(flowConsulta);
            } 
            else{
                return fallBack('Opción no válida. Por favor, intenta de nuevo.');
            };
        }
    });

const main = async () => {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flowPrincipal,flowTickets,flowCreation,flowJuno,flowVolver,flowFinal,flowConsulta, flowCaso,flowDetalleCaso, flowInicio]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb();
};

main();
