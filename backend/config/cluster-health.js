/**
 * Joyería Lumière - Módulo de Evaluación de Salud del Clúster y Quórum
 * Topología de 3 Nodos: 1 Primario (Escritura) + 2 Réplicas (Lectura)
 */

/**
 * Calcula la salud y el quórum del clúster de bases de datos.
 *
 * @param {Object} primaryData - Información de salud del nodo primario
 * @param {Array<Object>} replicaChecks - Array con el estado de cada réplica
 * @returns {Object} { status, httpCode, quorum: { total_nodes, healthy_nodes, quorum_threshold, quorum_reached } }
 */
function calculateClusterHealth(primaryData, replicaChecks) {
    const replicas = Array.isArray(replicaChecks) ? replicaChecks : [];
    const totalConfiguredNodes = 1 + replicas.length;
    const quorumThreshold = Math.floor(totalConfiguredNodes / 2) + 1;

    // El primario es verdaderamente saludable solo si responde y NO está en modo recovery (read-only)
    const isPrimaryWritable = Boolean(
        primaryData &&
        primaryData.status === 'healthy' &&
        primaryData.in_recovery === false
    );

    const healthyReplicas = replicas.filter(r => r && r.status === 'healthy');
    const healthyReplicasCount = healthyReplicas.length;

    // Promoción detectada: réplicas que salieron del modo recovery (pg_is_in_recovery = false)
    const promotedReplica = healthyReplicas.find(r => r.in_recovery === false);
    const standbyReplicas = healthyReplicas.filter(r => r.in_recovery === true);

    // DEDUPLICACIÓN DE QUÓRUM:
    // Evita el bug de doble conteo post-failover donde el alias 'db' (primaryData)
    // y la réplica promovida apuntan al mismo contenedor físico.
    let uniqueHealthyNodes = 0;

    // Si disponemos de IPs de servidor (inet_server_addr), deduplicar por endpoint real
    const serverIps = new Set();
    if (primaryData && primaryData.status === 'healthy' && primaryData.server_ip) {
        serverIps.add(`${primaryData.server_ip}:${primaryData.port || 5432}`);
    }
    for (const r of healthyReplicas) {
        if (r.server_ip) {
            serverIps.add(`${r.server_ip}:${r.port || 5432}`);
        }
    }

    if (serverIps.size > 0) {
        uniqueHealthyNodes = serverIps.size;
    } else {
        // Fallback lógico cuando server_ip no está disponible (ej. tests unitarios):
        // Si el primario es saludable y además una réplica figura con in_recovery = false,
        // dicha réplica y el primario representan el mismo nodo promovido (conteo = 1).
        if (isPrimaryWritable) {
            uniqueHealthyNodes += 1;
            // Contar únicamente las réplicas que continúan siendo standbys distintas
            const distinctReplicas = promotedReplica ? standbyReplicas.length : healthyReplicasCount;
            uniqueHealthyNodes += distinctReplicas;
        } else if (primaryData && primaryData.status === 'healthy' && primaryData.in_recovery === true) {
            // El endpoint de primario responde pero está en recovery (apunta a un standby)
            // No sumar primario writable; las réplicas ya cuentan los nodos standby
            uniqueHealthyNodes = Math.max(1, healthyReplicasCount);
        } else {
            // Primario caído: todas las réplicas saludables son nodos físicos distintos
            uniqueHealthyNodes = healthyReplicasCount;
        }
    }

    const quorumReached = uniqueHealthyNodes >= quorumThreshold;

    let status;
    let httpCode = 200;

    if (isPrimaryWritable && healthyReplicasCount === replicas.length) {
        // 3/3 nodos saludables
        status = 'healthy';
    } else if (isPrimaryWritable && healthyReplicasCount > 0) {
        // Falla parcial tolerada con quórum mantenido (ej. 2/3)
        status = 'healthy_partial_replica';
    } else if (isPrimaryWritable && healthyReplicasCount === 0) {
        // Solo primario vivo (quórum perdido en clúster de 3 nodos)
        status = 'degraded_no_replica';
    } else if (!isPrimaryWritable && healthyReplicasCount > 0) {
        if (promotedReplica) {
            if (standbyReplicas.length > 0) {
                // Post-failover con réplica promovida + standbys supervivientes
                status = 'promoted_primary_with_standby';
            } else {
                // Post-failover con réplica promovida sin standbys adicionales
                status = 'promoted_primary_no_standby';
            }
        } else {
            // Primario caído, solo réplicas de lectura disponibles
            status = 'degraded_read_only';
        }
    } else {
        // Todos los nodos caídos
        status = 'outage';
        httpCode = 503;
    }

    return {
        status,
        httpCode,
        quorum: {
            total_nodes: totalConfiguredNodes,
            healthy_nodes: uniqueHealthyNodes,
            quorum_threshold: quorumThreshold,
            quorum_reached: quorumReached
        }
    };
}

module.exports = {
    calculateClusterHealth
};
